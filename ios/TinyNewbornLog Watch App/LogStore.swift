import Foundation

@MainActor
final class LogStore: ObservableObject {
    @Published private(set) var entries: [NewbornLogEntry] = []
    @Published private(set) var activeSleepStartedAt: Date?
    @Published private(set) var activeActivities: [LogKind: Date] = [:]
    @Published private(set) var syncStatus = "Ready"
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
        updatePendingSyncStatus()

        Task {
            await retryPendingSyncs()
        }
    }

    var todaysEntries: [NewbornLogEntry] {
        entries.filter { Calendar.current.isDateInToday($0.startedAt) }
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
        todaysEntries.filter { $0.kind == kind }.count
    }

    func toggleSleep() {
        if let startedAt = activeSleepStartedAt {
            addEntry(NewbornLogEntry(kind: .sleep, startedAt: startedAt, endedAt: Date()))
            activeSleepStartedAt = nil
            UserDefaults.standard.removeObject(forKey: activeSleepKey)
            syncSleep(status: "awake")
        } else {
            activeSleepStartedAt = Date()
            UserDefaults.standard.set(activeSleepStartedAt?.timeIntervalSince1970 ?? 0, forKey: activeSleepKey)
            syncSleep(status: "asleep")
        }
    }

    func logNursing(side: NursingSide) {
        addEntry(NewbornLogEntry(kind: .nursing, side: side))
        syncNursing(side: side)
    }

    func logBottle(amountML: Double) {
        addEntry(NewbornLogEntry(kind: .bottle, amountML: amountML))
        syncBottle(amountML: amountML)
    }

    func logDiaper(_ event: DiaperEvent) {
        addEntry(NewbornLogEntry(kind: .diaper, detail: event.rawValue))
        enqueueSync([
            "type": "diaper",
            "kind": event == .wee ? "pee" : "poop",
            "poop": event == .poo,
            "notes": event == .wee ? "Wee diaper" : "Poo diaper"
        ])
    }

    func logMeasurement(kind: MeasurementKind, value: Double) {
        addEntry(NewbornLogEntry(kind: .babyStats, amountML: value, detail: kind.rawValue, amountUnit: kind.unit))
        if kind == .weight {
            enqueueSync([
                "type": "growth_stats",
                "stat": "weight",
                "weight": value,
                "weightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ])
        } else {
            enqueueSync([
                "type": "growth_stats",
                "stat": "height",
                "height": value,
                "heightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ])
        }
    }

    func logQuickActivity(_ kind: LogKind) {
        addEntry(NewbornLogEntry(kind: kind))
        syncActivity(kind)
    }

    func logRoutine(_ routine: RoutineKind) {
        addEntry(NewbornLogEntry(kind: .routines, detail: routine.rawValue))
        enqueueSync([
            "type": "routine",
            "routine": routine.payloadValue,
            "notes": "\(routine.rawValue) done"
        ])
    }

    func toggleTimedActivity(_ kind: LogKind) {
        if let startedAt = activeActivities[kind] {
            addEntry(NewbornLogEntry(kind: kind, startedAt: startedAt, endedAt: Date(), detail: "Ended"))
            activeActivities.removeValue(forKey: kind)
            saveActiveActivities()
            syncActivity(kind, status: "end")
        } else {
            activeActivities[kind] = Date()
            saveActiveActivities()
            syncActivity(kind, status: "start")
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
            updatePendingSyncStatus()
            return
        }

        isRetryingPendingSync = true
        syncStatus = "Syncing..."

        while let item = pendingSyncItems.first {
            do {
                try await WebLogSyncClient.shared.postLogData(item.body)
                pendingSyncItems.removeFirst()
                savePendingSyncItems()
            } catch {
                break
            }
        }

        isRetryingPendingSync = false
        updatePendingSyncStatus()
    }

    private func addEntry(_ entry: NewbornLogEntry) {
        entries.insert(entry, at: 0)
        saveEntries()
    }

    private func syncSleep(status: String) {
        enqueueSync([
            "type": "sleep",
            "status": status,
            "notes": status == "asleep" ? "Baby fell asleep" : "Baby woke up"
        ])
    }

    private func syncNursing(side: NursingSide) {
        let webSide = side == .right ? "right" : "left"
        enqueueSync([
            "type": "feeding",
            "method": "breast",
            "side": webSide,
            "notes": "Started on \(webSide) side"
        ])
    }

    private func syncBottle(amountML: Double) {
        let ounces = (amountML / 29.5735 * 100).rounded() / 100
        enqueueSync([
            "type": "bottle",
            "ounces": ounces,
            "notes": "Bottle feed"
        ])
    }

    private func syncActivity(_ kind: LogKind, status: String? = nil) {
        var payload: [String: Any] = [
            "type": webType(for: kind),
            "notes": note(for: kind, status: status)
        ]

        if let status {
            payload["status"] = status
        }

        enqueueSync(payload)
    }

    private func enqueueSync(_ payload: [String: Any]) {
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            syncStatus = "Sync failed"
            return
        }

        pendingSyncItems.append(PendingSyncItem(body: body))
        savePendingSyncItems()
        updatePendingSyncStatus()

        Task {
            await retryPendingSyncs()
        }
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

    private func note(for kind: LogKind, status: String?) -> String {
        if let status {
            return "\(kind.title) \(status)"
        }

        return "\(kind.title) logged"
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
        pendingSyncCount = pendingSyncItems.count
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
    var createdAt: Date
    var body: Data

    init(id: UUID = UUID(), createdAt: Date = Date(), body: Data) {
        self.id = id
        self.createdAt = createdAt
        self.body = body
    }
}
