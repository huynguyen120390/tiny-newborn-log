import Foundation

@MainActor
final class LogStore: ObservableObject {
    @Published private(set) var entries: [NewbornLogEntry] = []
    @Published private(set) var activeSleepStartedAt: Date?
    @Published private(set) var activeActivities: [LogKind: Date] = [:]
    @Published private(set) var syncStatus = "Ready"

    private let activeSleepKey = "activeSleepStartedAt"
    private let activeActivitiesKey = "activeActivityStartedAt"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init() {
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
        loadEntries()
        loadActiveSleep()
        loadActiveActivities()
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
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logDiaper(event)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
    }

    func logMeasurement(kind: MeasurementKind, value: Double) {
        addEntry(NewbornLogEntry(kind: .babyStats, amountML: value, detail: kind.rawValue, amountUnit: kind.unit))
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logMeasurement(kind: kind, value: value)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
    }

    func logQuickActivity(_ kind: LogKind) {
        addEntry(NewbornLogEntry(kind: kind))
        syncActivity(kind)
    }

    func logRoutine(_ routine: RoutineKind) {
        addEntry(NewbornLogEntry(kind: .routines, detail: routine.rawValue))
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logRoutine(routine)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
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

    private func addEntry(_ entry: NewbornLogEntry) {
        entries.insert(entry, at: 0)
        saveEntries()
    }

    private func syncSleep(status: String) {
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logSleep(status: status)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
    }

    private func syncNursing(side: NursingSide) {
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logNursing(side: side)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
    }

    private func syncBottle(amountML: Double) {
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logBottle(amountML: amountML)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
    }

    private func syncActivity(_ kind: LogKind, status: String? = nil) {
        syncStatus = "Syncing..."
        Task {
            do {
                try await WebLogSyncClient.shared.logActivity(kind: kind, status: status)
                await MainActor.run { syncStatus = "Synced" }
            } catch {
                await MainActor.run { syncStatus = "Sync failed" }
            }
        }
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
}
