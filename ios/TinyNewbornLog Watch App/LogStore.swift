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
    @Published private(set) var unitSettings = UnitSettings()

    private let activeSleepKey = "activeSleepStartedAt"
    private let activeActivitiesKey = "activeActivityStartedAt"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var pendingSyncItems: [PendingSyncItem] = []
    private var isRetryingPendingSync = false

    init() {
        UserDefaults.standard.register(defaults: [WatchScheduleNotifications.storageKey: true])
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
        todaysDurationSeconds(for: .sleep)
    }

    var todaysNursingCount: Int {
        todaysEntries.filter { $0.kind == .nursing }.count
    }

    var todaysBottleML: Double {
        todaysEntries
            .compactMap { $0.kind == .bottle ? $0.amountML : nil }
            .reduce(0, +)
    }

    func latestEntry(for kind: LogKind) -> NewbornLogEntry? {
        entries
            .filter { $0.kind == kind }
            .sorted { $0.startedAt > $1.startedAt }
            .first
    }

    func latestBottleAmount(for milkType: BottleMilkType) -> Double {
        displayBottleAmount(fromML: latestBottleEntry(for: milkType)?.amountML ?? 60)
    }

    func latestMeasurementValue(for kind: MeasurementKind) -> Double {
        let latest = entries
            .filter { $0.kind == .babyStats && $0.detail == kind.rawValue }
            .sorted { $0.startedAt > $1.startedAt }
            .first

        guard let entry = latest, let value = entry.amountML else {
            return kind == .weight ? displayWeight(8.0, from: "lb") : displayHeight(20.0, from: "in")
        }

        return kind == .weight
            ? displayWeight(value, from: entry.amountUnit ?? "lb")
            : displayHeight(value, from: entry.amountUnit ?? "in")
    }

    func todaysTotalText(for kind: LogKind) -> String {
        switch kind {
        case .nursing:
            return "\(todaysCount(for: .nursing)) feeds today"
        case .bottle:
            return "\(formatBottleAmount(fromML: todaysBottleML)) today"
        case .diaper:
            return "\(todaysDiaperSummary()) today"
        case .babyStats:
            return "\(todaysCount(for: .babyStats)) stats today"
        case .babyGym:
            return "\(todaysCount(for: .babyGym)) gym today"
        case .routines:
            return "\(todaysCount(for: .routines)) routines today"
        default:
            return "\(todaysCount(for: kind)) today"
        }
    }

    func todaysDiaperSummary() -> String {
        let wees = todaysEntries.filter { $0.kind == .diaper && $0.poopColorID == nil && ($0.detail ?? "Wee") == "Wee" }.count
        let poos = todaysEntries.filter { $0.kind == .diaper && ($0.poopColorID != nil || ($0.detail ?? "").contains("Poo")) }.count
        return "\(wees) Wee \(poos) Poo"
    }

    func latestStatsSummary() -> String {
        let weight = latestMeasurementSummary(for: .weight)
        let height = latestMeasurementSummary(for: .height)

        switch (weight, height) {
        case let (weight?, height?):
            return "\(weight), \(height)"
        case let (weight?, nil):
            return weight
        case let (nil, height?):
            return height
        default:
            return "No stats"
        }
    }

    func measurementUnit(for kind: MeasurementKind) -> String {
        unitSettings.unit(for: kind)
    }

    func bottleDisplayUnit() -> String {
        unitSettings.milkUnit
    }

    func displayBottleAmount(fromML amountML: Double) -> Double {
        if unitSettings.milkUnit == "oz" {
            return (amountML / 29.5735 * 100).rounded() / 100
        }
        return (amountML / 5).rounded() * 5
    }

    func bottleML(fromDisplayAmount amount: Double) -> Double {
        if unitSettings.milkUnit == "oz" {
            return amount * 29.5735
        }
        return amount
    }

    func formatBottleAmount(fromML amountML: Double) -> String {
        let amount = displayBottleAmount(fromML: amountML)
        if unitSettings.milkUnit == "oz" {
            return "\(NumberFormatter.shortDecimal.string(from: NSNumber(value: amount)) ?? "\(amount)") oz"
        }
        return "\(Int(amount.rounded())) ml"
    }

    func displayWeight(_ value: Double, from unit: String) -> Double {
        convertWeight(value, from: unit, to: unitSettings.weightUnit)
    }

    func displayHeight(_ value: Double, from unit: String) -> Double {
        convertHeight(value, from: unit, to: unitSettings.heightUnit)
    }

    func lastSummary(for kind: LogKind) -> String {
        guard let entry = latestEntry(for: kind) else {
            return "Last time: none"
        }

        return "Last: \(entry.startedAt.formatted(date: .abbreviated, time: .shortened)) \(detailText(for: entry))"
    }

    func lastDetail(for kind: LogKind) -> String {
        guard let entry = latestEntry(for: kind) else {
            return "No previous log"
        }

        return "\(entry.startedAt.formatted(date: .abbreviated, time: .shortened)) \(detailText(for: entry))"
    }

    func todaysCount(for kind: LogKind) -> Int {
        todayEntries(matching: kind).count
    }

    func todaysDurationSeconds(for kind: LogKind) -> TimeInterval {
        let completed = entries
            .filter { $0.kind == kind && $0.endedAt != nil }
            .reduce(0) { $0 + clippedDuration($1, inDayOffset: 0) }

        return completed + activeDurationSeconds(for: kind, inDayOffset: 0)
    }

    func todaysDurationText(for kind: LogKind) -> String {
        formatDuration(todaysDurationSeconds(for: kind))
    }

    func lastCompletedDuration(for kind: LogKind) -> (startedAt: Date, endedAt: Date, seconds: TimeInterval)? {
        entries
            .filter { $0.kind == kind && $0.endedAt != nil }
            .sorted { ($0.endedAt ?? $0.startedAt) > ($1.endedAt ?? $1.startedAt) }
            .first
            .flatMap { entry in
                guard let endedAt = entry.endedAt else { return nil }
                return (entry.startedAt, endedAt, entry.durationSeconds)
            }
    }

    func lastCompletedDurationText(for kind: LogKind) -> String {
        guard let last = lastCompletedDuration(for: kind) else {
            return "0m"
        }

        return formatDuration(last.seconds)
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
        Task {
            await notifyBoobieReminder(after: side)
        }
    }

    func logBottle(amountML: Double, milkType: BottleMilkType) {
        let storedML = bottleML(fromDisplayAmount: amountML)
        let entry = addEntry(NewbornLogEntry(kind: .bottle, amountML: storedML, detail: milkType.rawValue, amountUnit: "ml", milkType: milkType))
        syncBottle(amountML: storedML, milkType: milkType, entryID: entry.id)
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
        let unit = measurementUnit(for: kind)
        let entry = addEntry(NewbornLogEntry(kind: .babyStats, amountML: value, detail: kind.rawValue, amountUnit: unit))
        if kind == .weight {
            enqueueSync([
                "type": "growth_stats",
                "stat": "weight",
                "weight": value,
                "weightUnit": unit,
                "notes": "\(kind.rawValue): \(value) \(unit)"
            ], entryID: entry.id, title: entryTitle(entry))
        } else {
            enqueueSync([
                "type": "growth_stats",
                "stat": "height",
                "height": value,
                "heightUnit": unit,
                "notes": "\(kind.rawValue): \(value) \(unit)"
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
            let type = entry.milkType?.rawValue ?? entry.detail ?? "Milk"
            return "\(formatBottleAmount(fromML: entry.amountML ?? 0)) \(type)"
        case .diaper:
            if let label = PoopColorOption.label(for: entry.poopColorID) {
                return "Poo: \(label)"
            }
            return entry.detail ?? "Logged"
        case .babyStats:
            let isHeight = entry.detail == "Height"
            let unit = measurementUnit(for: isHeight ? .height : .weight)
            let sourceUnit = entry.amountUnit ?? (isHeight ? "in" : "lb")
            let displayValue = entry.amountML.map {
                isHeight ? convertHeight($0, from: sourceUnit, to: unit) : convertWeight($0, from: sourceUnit, to: unit)
            }
            let value = displayValue.map { NumberFormatter.shortDecimal.string(from: NSNumber(value: $0)) ?? "\($0)" } ?? ""
            return "\(entry.detail ?? "Value") \(value) \(unit)"
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
        let totalSeconds = max(Int(seconds.rounded()), 0)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        }

        return String(format: "%02d:%02d", minutes, seconds)
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

    private func syncBottle(amountML: Double, milkType: BottleMilkType, entryID: UUID) {
        let ounces = (amountML / 29.5735 * 100).rounded() / 100
        enqueueSync([
            "type": "bottle",
            "ounces": ounces,
            "milkType": milkType.payloadValue,
            "notes": "\(milkType.rawValue) bottle feed"
        ], entryID: entryID, title: "\(Int(amountML)) ml \(milkType.rawValue)")
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
            payload["milkType"] = (entry.milkType ?? BottleMilkType.fromPayload(entry.detail)).payloadValue
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
        let range = dayRange(offset: offset)
        let entryEnd = effectiveEndDate(for: entry)
        return entry.startedAt < range.end && entryEnd >= range.start
    }

    private func dayRange(offset: Int) -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: offset, to: todayStart) ?? todayStart
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? Date()
        return (start, end)
    }

    private func clippedDuration(_ entry: NewbornLogEntry, inDayOffset offset: Int) -> TimeInterval {
        let range = dayRange(offset: offset)
        let startedAt = max(entry.startedAt, range.start)
        let endedAt = min(effectiveEndDate(for: entry), range.end)
        return max(endedAt.timeIntervalSince(startedAt), 0)
    }

    private func activeDurationSeconds(for kind: LogKind, inDayOffset offset: Int) -> TimeInterval {
        let startedAt: Date?
        if kind == .sleep {
            startedAt = activeSleepStartedAt
        } else {
            startedAt = activeActivities[kind]
        }

        guard let startedAt else {
            return 0
        }

        return clippedDuration(NewbornLogEntry(kind: kind, startedAt: startedAt, endedAt: Date(), syncState: .synced), inDayOffset: offset)
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
            unitSettings = try await WebLogSyncClient.shared.fetchUnitSettings()
        } catch {
            // Keep the last known/default units when settings are unreachable.
        }

        do {
            let remoteLogs = try await WebLogSyncClient.shared.fetchLogs()
            mergeRemoteLogs(remoteLogs)
            await refreshScheduleNotifications()
        } catch {
            // Offline is acceptable; pending local logs remain queued.
        }
    }

    private func mergeRemoteLogs(_ remoteLogs: [RemoteBabyLog]) {
        var next = entries
        let pendingEntryIDs = Set(pendingSyncItems.compactMap(\.entryID))
        var knownRemoteIDs = Set(next.compactMap(\.remoteID))
        knownRemoteIDs.formUnion(next.map { $0.id.uuidString })

        for entry in pairedRemoteEntries(from: remoteLogs) {

            if let uuid = UUID(uuidString: entry.remoteID ?? entry.id.uuidString),
               let index = next.firstIndex(where: { $0.id == uuid }) {
                next[index].syncState = pendingEntryIDs.contains(uuid) ? .pending : .synced
                next[index].remoteID = entry.remoteID
                next[index].startedAt = entry.startedAt
                next[index].endedAt = entry.endedAt
                continue
            }

            guard let remoteID = entry.remoteID, !knownRemoteIDs.contains(remoteID) else {
                continue
            }

            next.append(entry)
            knownRemoteIDs.insert(remoteID)
        }

        entries = next.sorted { $0.startedAt > $1.startedAt }
        applyRemoteActiveState(remoteLogs)
        pruneCachedEntries()
        saveEntries()
    }

    private func pairedRemoteEntries(from remoteLogs: [RemoteBabyLog]) -> [NewbornLogEntry] {
        let sorted = remoteLogs.sorted { $0.eventDate < $1.eventDate }
        var entries: [NewbornLogEntry] = []
        var openDurations: [String: RemoteBabyLog] = [:]
        let durationTypes = Set(["sleep", "bath", "tummy_time", "outdoor_time"])

        for remote in sorted {
            guard durationTypes.contains(remote.type) else {
                if let entry = remote.localEntry {
                    entries.append(entry)
                }
                continue
            }

            if remote.status == "asleep" || remote.status == "start" {
                openDurations[remote.type] = remote
                continue
            }

            if remote.status == "awake" || remote.status == "end" {
                if let started = openDurations[remote.type],
                   var entry = remote.localEntry {
                    entry.startedAt = started.eventDate
                    entry.endedAt = remote.eventDate
                    entry.detail = "Ended"
                    entries.append(entry)
                    openDurations[remote.type] = nil
                } else if let entry = remote.localEntry {
                    entries.append(entry)
                }
                continue
            }

            if let entry = remote.localEntry {
                entries.append(entry)
            }
        }

        for remote in openDurations.values {
            if let entry = remote.localEntry {
                entries.append(entry)
            }
        }

        return entries
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
            return "\(formatBottleAmount(fromML: entry.amountML ?? 0)) \(entry.milkType?.rawValue ?? entry.detail ?? "bottle")"
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

    private func latestBottleEntry(for milkType: BottleMilkType) -> NewbornLogEntry? {
        entries
            .filter { $0.kind == .bottle && ($0.milkType ?? BottleMilkType.fromPayload($0.detail)) == milkType }
            .sorted { $0.startedAt > $1.startedAt }
            .first
    }

    private func latestMeasurementSummary(for kind: MeasurementKind) -> String? {
        let unit = measurementUnit(for: kind)
        let latest = entries
            .filter { $0.kind == .babyStats && $0.detail == kind.rawValue }
            .sorted { $0.startedAt > $1.startedAt }
            .first

        guard let latest, let value = latest.amountML else {
            return nil
        }

        let sourceUnit = latest.amountUnit ?? kind.unit
        let displayValue = kind == .weight
            ? convertWeight(value, from: sourceUnit, to: unit)
            : convertHeight(value, from: sourceUnit, to: unit)
        let formatted = NumberFormatter.shortDecimal.string(from: NSNumber(value: displayValue)) ?? "\(displayValue)"
        return "\(formatted) \(unit)"
    }

    private func notifyBoobieReminder(after side: NursingSide) async {
        let nextSide = side == .left ? "right" : "left"
        let content = UNMutableNotificationContent()
        content.title = "Boobie reminder"
        content.body = "Drain breasts. Try \(nextSide) next time. Warm breast. Cool breast."
        content.sound = .default
        let request = UNNotificationRequest(identifier: "boobie-\(UUID().uuidString)", content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }

    private func refreshScheduleNotifications() async {
        guard UserDefaults.standard.bool(forKey: WatchScheduleNotifications.storageKey) else {
            WatchScheduleReminderPlanner.cancel(identifierPrefix: WatchScheduleNotifications.identifierPrefix)
            return
        }
        guard let scheduleLogs = try? await WebLogSyncClient.shared.fetchScheduleLogs() else {
            return
        }

        let today = WatchScheduleReminderPlanner.todayString()
        let rows = scheduleLogs.first(where: { $0.date == today })?.rows ?? []
        await WatchScheduleReminderPlanner.reschedule(
            rows: rows,
            date: today,
            identifierPrefix: WatchScheduleNotifications.identifierPrefix
        )
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

enum WatchScheduleReminderPlanner {
    static func cancel(identifierPrefix: String) {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let identifiers = requests
                .filter { $0.identifier.hasPrefix(identifierPrefix) }
                .map(\.identifier)
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers)
        }
    }

    static func todayString(now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: now)
    }

    static func reschedule(rows: [WatchScheduleRow], date: String, identifierPrefix: String) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(identifierPrefix) }
            .map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: pending)

        let now = Date()
        for (index, row) in rows.enumerated() {
            guard let startDate = startDate(for: row, date: date), startDate > now else {
                continue
            }

            let content = UNMutableNotificationContent()
            let activity = clean(row.activity, fallback: "Scheduled activity")
            content.title = "Schedule: \(activity)"
            content.body = reminderBody(for: row)
            content.sound = .default

            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: startDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let request = UNNotificationRequest(
                identifier: "\(identifierPrefix)\(date)-\(index)",
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
        }
    }

    private static func reminderBody(for row: WatchScheduleRow) -> String {
        let activity = clean(row.activity, fallback: "Activity")
        let lower = activity.lowercased()
        if lower.contains("feed") {
            if let goal = row.feedGoalOz {
                return "\(activity) now. Goal \(formatOunces(goal))."
            }
            return "\(activity) now."
        }
        if lower.contains("nap") || lower.contains("sleep") {
            return "\(activity) now. Sleep goal \(clean(row.sleepGoal ?? row.plannedDuration, fallback: "scheduled"))."
        }
        if lower.contains("play") {
            return "\(activity) now. \(clean(row.playGoal, fallback: "Follow today's plan"))."
        }
        return "\(activity) now. Goal \(clean(row.plannedDuration, fallback: "scheduled"))."
    }

    private static func startDate(for row: WatchScheduleRow, date: String) -> Date? {
        guard let timeOfDay = row.timeOfDay,
              let range = scheduleTimeRange(timeOfDay),
              let base = dayStart(date) else {
            return nil
        }
        return Calendar.current.date(byAdding: .minute, value: range.start, to: base)
    }

    private static func scheduleTimeRange(_ value: String) -> (start: Int, end: Int)? {
        let parts = value.split(separator: "-", maxSplits: 1).map { String($0) }
        guard let first = parts.first else { return nil }
        let fallback = parts.dropFirst().first.flatMap(meridiem) ?? meridiem(first)
        guard let start = timeToMinutes(first, fallbackMeridiem: fallback) else { return nil }
        let end = parts.dropFirst().first.flatMap { timeToMinutes($0, fallbackMeridiem: fallback) } ?? start + 30
        return (start, end < start ? end + 24 * 60 : end)
    }

    private static func meridiem(_ value: String) -> String? {
        let upper = value.uppercased()
        if upper.contains("AM") { return "AM" }
        if upper.contains("PM") { return "PM" }
        return nil
    }

    private static func timeToMinutes(_ value: String, fallbackMeridiem: String?) -> Int? {
        let cleanValue = value
            .uppercased()
            .replacingOccurrences(of: "AM", with: "")
            .replacingOccurrences(of: "PM", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let pieces = cleanValue.split(separator: ":").map { String($0) }
        guard let hourText = pieces.first,
              var hour = Int(hourText) else {
            return nil
        }
        let minute = pieces.dropFirst().first.flatMap(Int.init) ?? 0
        let marker = meridiem(value) ?? fallbackMeridiem
        if marker == "PM", hour < 12 { hour += 12 }
        if marker == "AM", hour == 12 { hour = 0 }
        return hour * 60 + minute
    }

    private static func dayStart(_ date: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: date)
    }

    private static func formatOunces(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if rounded == rounded.rounded() {
            return "\(Int(rounded)) oz"
        }
        return "\(rounded) oz"
    }

    private static func clean(_ value: String?, fallback: String) -> String {
        let text = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? fallback : text
    }
}

private extension NumberFormatter {
    static let shortDecimal: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }()
}

private func convertWeight(_ value: Double, from sourceUnit: String, to targetUnit: String) -> Double {
    let gramsByUnit = ["oz": 28.349523125, "lb": 453.59237, "g": 1.0, "kg": 1000.0]
    let grams = value * (gramsByUnit[sourceUnit] ?? gramsByUnit["lb"]!)
    let converted = grams / (gramsByUnit[targetUnit] ?? gramsByUnit["lb"]!)
    return roundedMeasurement(converted, unit: targetUnit)
}

private func convertHeight(_ value: Double, from sourceUnit: String, to targetUnit: String) -> Double {
    let mmByUnit = ["in": 25.4, "ft": 304.8, "cm": 10.0, "mm": 1.0]
    let mm = value * (mmByUnit[sourceUnit] ?? mmByUnit["in"]!)
    let converted = mm / (mmByUnit[targetUnit] ?? mmByUnit["in"]!)
    return roundedMeasurement(converted, unit: targetUnit)
}

private func roundedMeasurement(_ value: Double, unit: String) -> Double {
    if unit == "g" || unit == "mm" {
        return value.rounded()
    }
    return (value * 10).rounded() / 10
}
