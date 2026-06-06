import Foundation
import UserNotifications

@MainActor
final class LogStore: ObservableObject {
    @Published private(set) var entries: [NewbornLogEntry] = []
    @Published private(set) var activeSleepStartedAt: Date?
    @Published private(set) var activeActivities: [LogKind: Date] = [:]
    @Published private(set) var syncStatus = "Ready"
    @Published private(set) var lastLogMessage = "Ready"
    @Published private(set) var pendingSyncCount = 0

    private let activeSleepKey = "activeSleepStartedAt"
    private let activeActivitiesKey = "activeActivityStartedAt"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var pendingSyncItems: [PendingSyncItem] = []
    private var isRetryingPendingSync = false

    init() {
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
        loadEntries()
        loadActiveSleep()
        loadActiveActivities()
        loadPendingSyncItems()
        pruneCachedEntries()
        updatePendingSyncStatus()

        Task {
            await requestNotificationPermission()
            await retryPendingSyncs()
            await pullServerLogs()
        }
    }

    var todaysEntries: [NewbornLogEntry] {
        todayEntries(matching: nil)
    }

    var recentEntries: [NewbornLogEntry] {
        Array(entries.prefix(15))
    }

    var todaysSleepSeconds: TimeInterval {
        todaysEntries
            .filter { $0.kind == .sleep }
            .reduce(0) { $0 + $1.durationSeconds }
    }

    var todaysNursingCount: Int {
        todaysEntries.filter { $0.kind == .nursing }.count
    }

    var todaysBottleML: Double {
        todaysEntries
            .compactMap { $0.kind == .bottle ? $0.amountML : nil }
            .reduce(0, +)
    }

    func todaysCount(for kind: LogKind) -> Int {
        todayEntries(matching: kind).count
    }

    func todayEntries(matching filter: LogKind?) -> [NewbornLogEntry] {
        entriesForDay(offset: 0, matching: filter)
    }

    func entriesForDay(offset: Int, matching filter: LogKind?) -> [NewbornLogEntry] {
        entries
            .filter { entry in
                (filter == nil || entry.kind == filter) && isVisible(entry, inDayOffset: offset)
            }
            .sorted { $0.startedAt > $1.startedAt }
    }

    func toggleSleep() {
        if let startedAt = activeSleepStartedAt {
            let entry = addEntry(NewbornLogEntry(kind: .sleep, startedAt: startedAt, endedAt: Date()))
            activeSleepStartedAt = nil
            UserDefaults.standard.removeObject(forKey: activeSleepKey)
            syncSleep(status: "awake", entryID: entry.id)
        } else {
            activeSleepStartedAt = Date()
            UserDefaults.standard.set(activeSleepStartedAt?.timeIntervalSince1970 ?? 0, forKey: activeSleepKey)
            let entry = addEntry(NewbornLogEntry(kind: .sleep, startedAt: activeSleepStartedAt ?? Date(), detail: "Started"))
            syncSleep(status: "asleep", entryID: entry.id)
        }
    }

    func logNursing(side: NursingSide) {
        let entry = addEntry(NewbornLogEntry(kind: .nursing, side: side))
        syncNursing(side: side, entryID: entry.id)
    }

    func logBottle(amountML: Double) {
        let entry = addEntry(NewbornLogEntry(kind: .bottle, amountML: amountML))
        syncBottle(amountML: amountML, entryID: entry.id)
    }

    func logDiaper(_ event: DiaperEvent, poopColor: PoopColorOption? = nil) {
        let detail = poopColor.map { "Poo: \($0.label)" } ?? event.rawValue
        let entry = addEntry(NewbornLogEntry(kind: .diaper, detail: detail, poopColorID: poopColor?.id))
        var payload: [String: Any] = [
            "type": "diaper",
            "kind": event == .wee ? "pee" : "poop",
            "poop": event == .poo,
            "notes": poopColor.map { "Poo: \($0.label)" } ?? (event == .wee ? "Wee diaper" : "Poo diaper")
        ]
        if event == .poo, let poopColor {
            payload["poopColorId"] = poopColor.id
            payload["poopColor"] = poopColor.id
        }
        enqueueSync(payload, entryID: entry.id, title: detail)
    }

    func logMeasurement(kind: MeasurementKind, value: Double) {
        let entry = addEntry(NewbornLogEntry(kind: .babyStats, amountML: value, detail: kind.rawValue, amountUnit: kind.unit))
        if kind == .weight {
            enqueueSync([
                "type": "growth_stats",
                "stat": "weight",
                "weight": value,
                "weightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ], entryID: entry.id, title: entryTitle(entry))
        } else {
            enqueueSync([
                "type": "growth_stats",
                "stat": "height",
                "height": value,
                "heightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ], entryID: entry.id, title: entryTitle(entry))
        }
    }

    func logQuickActivity(_ kind: LogKind) {
        let entry = addEntry(NewbornLogEntry(kind: kind))
        syncActivity(kind, entryID: entry.id)
    }

    func logRoutine(_ routine: RoutineKind) {
        let entry = addEntry(NewbornLogEntry(kind: .routines, detail: routine.rawValue))
        enqueueSync([
            "type": "routine",
            "routine": routine.payloadValue,
            "notes": "\(routine.rawValue) done"
        ], entryID: entry.id, title: entryTitle(entry))
    }

    func toggleTimedActivity(_ kind: LogKind) {
        if let startedAt = activeActivities[kind] {
            let entry = addEntry(NewbornLogEntry(kind: kind, startedAt: startedAt, endedAt: Date(), detail: "Ended"))
            activeActivities.removeValue(forKey: kind)
            saveActiveActivities()
            syncActivity(kind, status: "end", entryID: entry.id)
        } else {
            activeActivities[kind] = Date()
            saveActiveActivities()
            let entry = addEntry(NewbornLogEntry(kind: kind, startedAt: activeActivities[kind] ?? Date(), detail: "Started"))
            syncActivity(kind, status: "start", entryID: entry.id)
        }
    }

    func delete(at offsets: IndexSet) {
        let ids = offsets.map { recentEntries[$0].id }
        entries.removeAll { ids.contains($0.id) }
        saveEntries()
    }

    func detailText(for entry: NewbornLogEntry) -> String {
        switch entry.kind {
        case .sleep:
            return formatDuration(entry.durationSeconds)
        case .nursing:
            let side = entry.side?.rawValue ?? "Side"
            return side
        case .bottle:
            return "\(Int(entry.amountML ?? 0)) ml"
        case .diaper:
            if let label = PoopColorOption.label(for: entry.poopColorID) {
                return "Poo: \(label)"
            }
            return entry.detail ?? "Logged"
        case .babyStats:
            let value = entry.amountML.map { String(format: "%.1f", $0) } ?? ""
            return "\(entry.detail ?? "Value") \(value) \(entry.amountUnit ?? "")"
        case .bath, .tummyTime, .outdoorTime:
            if entry.endedAt != nil {
                return formatDuration(entry.durationSeconds)
            }

            return entry.detail ?? "Started"
        case .routines:
            return entry.detail ?? "Done"
        case .babyGym:
            return "Logged"
        }
    }

    func isPending(_ entry: NewbornLogEntry) -> Bool {
        entry.syncState == .pending || pendingSyncItems.contains { $0.entryID == entry.id }
    }

    func relog(_ updated: NewbornLogEntry) async {
        guard let index = entries.firstIndex(where: { $0.id == updated.id }) else {
            return
        }

        var next = updated
        next.syncState = .pending
        entries[index] = next
        entries.sort { $0.startedAt > $1.startedAt }
        saveEntries()
        lastLogMessage = "Relogged locally"

        guard let body = try? JSONSerialization.data(withJSONObject: updatePayload(for: next)) else {
            syncStatus = "Sync failed"
            updatePendingSyncStatus()
            return
        }

        if let pendingIndex = pendingSyncItems.firstIndex(where: { $0.entryID == next.id }) {
            if pendingSyncItems[pendingIndex].method == "PUT" {
                pendingSyncItems[pendingIndex].body = body
            } else {
                pendingSyncItems[pendingIndex].body = createBody(for: next)
            }
            pendingSyncItems[pendingIndex].title = "Relog \(next.kind.title)"
            savePendingSyncItems()
            updatePendingSyncStatus()
            await retryPendingSyncs()
            return
        }

        guard let remoteID = next.remoteID else {
            pendingSyncItems.append(PendingSyncItem(entryID: next.id, title: "Relog \(next.kind.title)", body: createBody(for: next)))
            savePendingSyncItems()
            updatePendingSyncStatus()
            await retryPendingSyncs()
            return
        }

        do {
            try await WebLogSyncClient.shared.updateLog(remoteID: remoteID, body: body)
            markEntrySynced(next.id)
            lastLogMessage = "Relogged on server"
            await pullServerLogs()
        } catch {
            pendingSyncItems.append(PendingSyncItem(entryID: next.id, remoteID: remoteID, method: "PUT", title: "Relog \(next.kind.title)", body: body))
            savePendingSyncItems()
            updatePendingSyncStatus()
        }
    }

    func remove(_ entry: NewbornLogEntry) async {
        entries.removeAll { $0.id == entry.id }
        pendingSyncItems.removeAll { $0.entryID == entry.id && $0.method != "DELETE" }
        saveEntries()
        savePendingSyncItems()
        lastLogMessage = "Removed locally"

        guard let remoteID = entry.remoteID else {
            updatePendingSyncStatus()
            return
        }

        do {
            try await WebLogSyncClient.shared.deleteLog(remoteID: remoteID)
            lastLogMessage = "Removed on server"
            updatePendingSyncStatus()
            await pullServerLogs()
        } catch {
            pendingSyncItems.append(PendingSyncItem(entryID: entry.id, remoteID: remoteID, method: "DELETE", title: "Remove \(entry.kind.title)", body: Data()))
            savePendingSyncItems()
            updatePendingSyncStatus()
        }
    }

    func formatDuration(_ seconds: TimeInterval) -> String {
        let totalMinutes = max(Int(seconds / 60), 0)
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }

        return "\(minutes)m"
    }

    func retryPendingSyncs() async {
        guard !isRetryingPendingSync, !pendingSyncItems.isEmpty else {
            await pullServerLogs()
            updatePendingSyncStatus()
            return
        }

        isRetryingPendingSync = true
        syncStatus = "Syncing..."
        var syncedItems: [PendingSyncItem] = []

        while let item = pendingSyncItems.first {
            do {
                if item.method == "DELETE", let remoteID = item.remoteID {
                    try await WebLogSyncClient.shared.deleteLog(remoteID: remoteID)
                } else if item.method == "PUT", let remoteID = item.remoteID {
                    try await WebLogSyncClient.shared.updateLog(remoteID: remoteID, body: item.body)
                } else {
                    try await WebLogSyncClient.shared.postLogData(item.body)
                }
                pendingSyncItems.removeFirst()
                markEntrySynced(item.entryID)
                syncedItems.append(item)
                savePendingSyncItems()
            } catch {
                break
            }
        }

        isRetryingPendingSync = false
        updatePendingSyncStatus()

        if !syncedItems.isEmpty {
            lastLogMessage = "Logged on server"
            await pullServerLogs()
            await notifyTransferredLogs(syncedItems)
        }
    }

    @discardableResult
    private func addEntry(_ entry: NewbornLogEntry) -> NewbornLogEntry {
        var localEntry = entry
        localEntry.syncState = .pending
        entries.insert(localEntry, at: 0)
        saveEntries()
        lastLogMessage = "Logged locally"
        return localEntry
    }

    private func syncSleep(status: String, entryID: UUID) {
        enqueueSync([
            "type": "sleep",
            "status": status,
            "notes": status == "asleep" ? "Baby fell asleep" : "Baby woke up"
        ], entryID: entryID, title: status == "asleep" ? "Sleep" : "Awake")
    }

    private func syncNursing(side: NursingSide, entryID: UUID) {
        let webSide = side == .right ? "right" : "left"
        enqueueSync([
            "type": "feeding",
            "method": "breast",
            "side": webSide,
            "notes": "Started on \(webSide) side"
        ], entryID: entryID, title: "\(side.rawValue) boobie")
    }

    private func syncBottle(amountML: Double, entryID: UUID) {
        let ounces = (amountML / 29.5735 * 100).rounded() / 100
        enqueueSync([
            "type": "bottle",
            "ounces": ounces,
            "notes": "Bottle feed"
        ], entryID: entryID, title: "\(Int(amountML)) ml bottle")
    }

    private func syncActivity(_ kind: LogKind, status: String? = nil, entryID: UUID) {
        var payload: [String: Any] = [
            "type": webType(for: kind),
            "notes": note(for: kind, status: status)
        ]

        if let status {
            payload["status"] = status
        }

        enqueueSync(payload, entryID: entryID, title: status == nil ? kind.title : "\(kind.title) \(status ?? "")")
    }

    private func enqueueSync(_ payload: [String: Any], entryID: UUID, title: String) {
        var payloadWithID = payload
        payloadWithID["id"] = entryID.uuidString
        if let entry = entries.first(where: { $0.id == entryID }) {
            payloadWithID = payloadWithEventTime(payloadWithID, for: entry)
        }

        guard let body = try? JSONSerialization.data(withJSONObject: payloadWithID) else {
            syncStatus = "Sync failed"
            return
        }

        pendingSyncItems.append(PendingSyncItem(entryID: entryID, title: title, body: body))
        savePendingSyncItems()
        updatePendingSyncStatus()

        Task {
            await retryPendingSyncs()
        }
    }

    private func payloadWithEventTime(_ payload: [String: Any], for entry: NewbornLogEntry) -> [String: Any] {
        var payload = payload
        let eventDate = serverEventDate(for: entry)
        payload["date"] = Self.payloadDateFormatter.string(from: eventDate)
        payload["time"] = Self.payloadTimeFormatter.string(from: eventDate)
        payload["createdAt"] = Self.payloadISOFormatter.string(from: eventDate)
        return payload
    }

    private func webType(for kind: LogKind) -> String {
        switch kind {
        case .sleep:
            return "sleep"
        case .nursing:
            return "feeding"
        case .bottle:
            return "bottle"
        case .diaper:
            return "diaper"
        case .babyStats:
            return "growth_stats"
        case .bath:
            return "bath"
        case .tummyTime:
            return "tummy_time"
        case .outdoorTime:
            return "outdoor_time"
        case .babyGym:
            return "baby_gym"
        case .routines:
            return "routine"
        }
    }

    private func createBody(for entry: NewbornLogEntry) -> Data {
        var payload = updatePayload(for: entry)
        payload["id"] = entry.id.uuidString
        payload["type"] = webType(for: entry.kind)
        if entry.kind == .nursing {
            payload["method"] = "breast"
        }
        return (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
    }

    private func updatePayload(for entry: NewbornLogEntry) -> [String: Any] {
        var payload: [String: Any] = [
            "date": Self.payloadDateFormatter.string(from: serverEventDate(for: entry)),
            "time": Self.payloadTimeFormatter.string(from: serverEventDate(for: entry)),
            "notes": entry.detail ?? entry.kind.title
        ]

        switch entry.kind {
        case .sleep:
            payload["status"] = entry.endedAt == nil ? "asleep" : "awake"
        case .nursing:
            payload["side"] = entry.side == .right ? "right" : "left"
        case .bottle:
            payload["ounces"] = ((entry.amountML ?? 0) / 29.5735 * 100).rounded() / 100
        case .diaper:
            let isPoo = entry.detail?.lowercased().contains("poo") == true || entry.poopColorID != nil
            payload["kind"] = isPoo ? "poop" : "pee"
            if isPoo, let poopColorID = entry.poopColorID {
                payload["poopColorId"] = poopColorID
                payload["poopColor"] = poopColorID
            }
        case .babyStats:
            if entry.detail == "Height" {
                payload["stat"] = "height"
                payload["height"] = entry.amountML ?? 0
                payload["heightUnit"] = entry.amountUnit ?? "in"
            } else {
                payload["stat"] = "weight"
                payload["weight"] = entry.amountML ?? 0
                payload["weightUnit"] = entry.amountUnit ?? "lb"
            }
        case .bath, .tummyTime, .outdoorTime:
            payload["status"] = entry.endedAt == nil ? "start" : "end"
        case .babyGym, .routines:
            break
        }

        return payload
    }

    private func isVisibleInToday(_ entry: NewbornLogEntry) -> Bool {
        isVisible(entry, inDayOffset: 0)
    }

    private func isVisible(_ entry: NewbornLogEntry, inDayOffset offset: Int) -> Bool {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: offset, to: todayStart) ?? todayStart
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? Date()
        let entryEnd = effectiveEndDate(for: entry)
        return entry.startedAt < end && entryEnd >= start
    }

    private func effectiveEndDate(for entry: NewbornLogEntry) -> Date {
        if let endedAt = entry.endedAt {
            return endedAt
        }

        return isActiveOpenEntry(entry) ? Date.distantFuture : entry.startedAt
    }

    private func isActiveOpenEntry(_ entry: NewbornLogEntry) -> Bool {
        switch entry.kind {
        case .sleep:
            guard let activeSleepStartedAt else { return false }
            return isSameEventTime(entry.startedAt, activeSleepStartedAt)
        case .bath, .tummyTime, .outdoorTime:
            guard let activeStartedAt = activeActivities[entry.kind] else { return false }
            return isSameEventTime(entry.startedAt, activeStartedAt)
        default:
            return false
        }
    }

    private func isSameEventTime(_ lhs: Date, _ rhs: Date) -> Bool {
        abs(lhs.timeIntervalSince(rhs)) < 60
    }

    private func pruneCachedEntries() {
        let pendingEntryIDs = Set(pendingSyncItems.compactMap(\.entryID))
        entries = entries.filter { entry in
            pendingEntryIDs.contains(entry.id)
                || isVisible(entry, inDayOffset: 0)
                || isVisible(entry, inDayOffset: -1)
                || isActiveOpenEntry(entry)
        }
    }

    private func isDurationKind(_ kind: LogKind) -> Bool {
        [.sleep, .bath, .tummyTime, .outdoorTime].contains(kind)
    }

    private func serverEventDate(for entry: NewbornLogEntry) -> Date {
        if entry.endedAt != nil, isDurationKind(entry.kind) {
            return entry.endedAt ?? entry.startedAt
        }
        return entry.startedAt
    }

    private static let payloadDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static let payloadTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static let payloadISOFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private func note(for kind: LogKind, status: String?) -> String {
        if let status {
            return "\(kind.title) \(status)"
        }

        return "\(kind.title) logged"
    }

    private func markEntrySynced(_ entryID: UUID?) {
        guard let entryID, let index = entries.firstIndex(where: { $0.id == entryID }) else {
            return
        }

        entries[index].syncState = .synced
        entries[index].remoteID = entryID.uuidString
        saveEntries()
    }

    private func pullServerLogs() async {
        do {
            let remoteLogs = try await WebLogSyncClient.shared.fetchLogs()
            mergeRemoteLogs(remoteLogs)
        } catch {
            // Offline is acceptable; pending local logs remain queued.
        }
    }

    private func mergeRemoteLogs(_ remoteLogs: [RemoteBabyLog]) {
        var next = entries
        let pendingEntryIDs = Set(pendingSyncItems.compactMap(\.entryID))
        var knownRemoteIDs = Set(next.compactMap(\.remoteID))
        knownRemoteIDs.formUnion(next.map { $0.id.uuidString })

        for remote in remoteLogs {
            guard let entry = remote.localEntry else {
                continue
            }

            if let uuid = UUID(uuidString: remote.id),
               let index = next.firstIndex(where: { $0.id == uuid }) {
                next[index].syncState = pendingEntryIDs.contains(uuid) ? .pending : .synced
                next[index].remoteID = remote.id
                continue
            }

            guard !knownRemoteIDs.contains(remote.id) else {
                continue
            }

            next.append(entry)
            knownRemoteIDs.insert(remote.id)
        }

        entries = next.sorted { $0.startedAt > $1.startedAt }
        applyRemoteActiveState(remoteLogs)
        pruneCachedEntries()
        saveEntries()
    }

    private func applyRemoteActiveState(_ remoteLogs: [RemoteBabyLog]) {
        let sorted = remoteLogs.sorted { $0.eventDate < $1.eventDate }

        if let lastSleep = sorted.last(where: { $0.type == "sleep" }) {
            if lastSleep.status == "asleep" {
                activeSleepStartedAt = lastSleep.eventDate
                UserDefaults.standard.set(lastSleep.eventDate.timeIntervalSince1970, forKey: activeSleepKey)
            } else {
                activeSleepStartedAt = nil
                UserDefaults.standard.removeObject(forKey: activeSleepKey)
            }
        }

        var nextActivities = activeActivities
        for kind in [LogKind.bath, .tummyTime, .outdoorTime] {
            guard let last = sorted.last(where: { $0.type == webType(for: kind) }) else {
                continue
            }
            if last.status == "start" {
                nextActivities[kind] = last.eventDate
            } else if last.status == "end" {
                nextActivities.removeValue(forKey: kind)
            }
        }
        activeActivities = nextActivities
        saveActiveActivities()
    }

    private func entryTitle(_ entry: NewbornLogEntry) -> String {
        switch entry.kind {
        case .nursing:
            return "\(entry.side?.rawValue ?? "") boobie".trimmingCharacters(in: .whitespaces)
        case .bottle:
            return "\(Int(entry.amountML ?? 0)) ml bottle"
        case .diaper:
            return entry.detail ?? entry.kind.title
        case .babyStats:
            let value = entry.amountML.map { String(format: "%.1f", $0) } ?? ""
            return "\(entry.detail ?? entry.kind.title) \(value)".trimmingCharacters(in: .whitespaces)
        default:
            return entry.kind.title
        }
    }

    private func requestNotificationPermission() async {
        do {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        } catch {
            // Notification permission is optional; sync should still work.
        }
    }

    private func notifyTransferredLogs(_ items: [PendingSyncItem]) async {
        let titles = items.map { $0.title }.filter { !$0.isEmpty }
        PhoneSyncNotifier.shared.sendTransferredLogs(titles)

        let content = UNMutableNotificationContent()
        content.title = items.count == 1 ? "Log synced" : "\(items.count) logs synced"
        content.body = titles.isEmpty ? "Transferred to server." : titles.joined(separator: ", ")
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "pending-sync-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )

        try? await UNUserNotificationCenter.current().add(request)
    }

    private func updatePendingSyncStatus() {
        pendingSyncCount = pendingSyncItems.count

        if pendingSyncCount > 0 {
            syncStatus = pendingSyncCount == 1 ? "1 pending" : "\(pendingSyncCount) pending"
        } else if syncStatus == "Syncing..." || syncStatus.contains("pending") || syncStatus == "Sync failed" {
            syncStatus = "Synced"
        }
    }

    private func loadPendingSyncItems() {
        guard let data = try? Data(contentsOf: pendingSyncURL) else {
            pendingSyncItems = []
            pendingSyncCount = 0
            return
        }

        pendingSyncItems = (try? decoder.decode([PendingSyncItem].self, from: data)) ?? []
        backfillPendingEventTimes()
        pendingSyncCount = pendingSyncItems.count
    }

    private func backfillPendingEventTimes() {
        var changed = false

        pendingSyncItems = pendingSyncItems.map { item in
            guard item.method != "DELETE",
                  var payload = try? JSONSerialization.jsonObject(with: item.body) as? [String: Any],
                  payload["date"] == nil || payload["time"] == nil else {
                return item
            }

            let eventDate = item.entryID.flatMap { entryID in
                entries.first(where: { $0.id == entryID }).map(serverEventDate)
            } ?? item.createdAt

            payload["date"] = Self.payloadDateFormatter.string(from: eventDate)
            payload["time"] = Self.payloadTimeFormatter.string(from: eventDate)
            payload["createdAt"] = Self.payloadISOFormatter.string(from: eventDate)

            guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
                return item
            }

            var next = item
            next.body = body
            changed = true
            return next
        }

        if changed {
            savePendingSyncItems()
        }
    }

    private func savePendingSyncItems() {
        guard let data = try? encoder.encode(pendingSyncItems) else {
            return
        }

        try? data.write(to: pendingSyncURL, options: [.atomic])
    }

    private func loadEntries() {
        guard let data = try? Data(contentsOf: entriesURL) else {
            return
        }

        entries = (try? decoder.decode([NewbornLogEntry].self, from: data)) ?? []
    }

    private func saveEntries() {
        guard let data = try? encoder.encode(entries) else {
            return
        }

        try? data.write(to: entriesURL, options: [.atomic])
    }

    private func loadActiveSleep() {
        let timestamp = UserDefaults.standard.double(forKey: activeSleepKey)
        activeSleepStartedAt = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    private func loadActiveActivities() {
        guard let stored = UserDefaults.standard.dictionary(forKey: activeActivitiesKey) as? [String: Double] else {
            return
        }

        activeActivities = stored.reduce(into: [LogKind: Date]()) { partialResult, item in
            guard let kind = LogKind(rawValue: item.key), item.value > 0 else {
                return
            }

            partialResult[kind] = Date(timeIntervalSince1970: item.value)
        }
    }

    private func saveActiveActivities() {
        let stored = activeActivities.reduce(into: [String: Double]()) { partialResult, item in
            partialResult[item.key.rawValue] = item.value.timeIntervalSince1970
        }

        UserDefaults.standard.set(stored, forKey: activeActivitiesKey)
    }

    private var entriesURL: URL {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return directory.appendingPathComponent("newborn-log.json")
    }

    private var pendingSyncURL: URL {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return directory.appendingPathComponent("pending-sync-queue.json")
    }
}

private struct PendingSyncItem: Identifiable, Codable, Hashable {
    let id: UUID
    var entryID: UUID?
    var remoteID: String?
    var method: String?
    var title: String
    var createdAt: Date
    var body: Data

    private enum CodingKeys: String, CodingKey {
        case id
        case entryID
        case remoteID
        case method
        case title
        case createdAt
        case body
    }

    init(id: UUID = UUID(), entryID: UUID? = nil, remoteID: String? = nil, method: String? = nil, title: String = "Log", createdAt: Date = Date(), body: Data) {
        self.id = id
        self.entryID = entryID
        self.remoteID = remoteID
        self.method = method
        self.title = title
        self.createdAt = createdAt
        self.body = body
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        entryID = try container.decodeIfPresent(UUID.self, forKey: .entryID)
        remoteID = try container.decodeIfPresent(String.self, forKey: .remoteID)
        method = try container.decodeIfPresent(String.self, forKey: .method)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Log"
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        body = try container.decode(Data.self, forKey: .body)
    }
}
