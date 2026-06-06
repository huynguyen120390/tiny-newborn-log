import SwiftUI
import UserNotifications

private let homeServerURL = URL(string: "http://192.168.86.55:3002")!
private let tailscaleServerURL = URL(string: "http://100.100.187.79:3002")!

private func readableElapsed(_ elapsed: TimeInterval) -> String {
    let totalSeconds = max(Int(elapsed.rounded()), 0)
    let hours = totalSeconds / 3600
    let minutes = (totalSeconds % 3600) / 60
    let seconds = totalSeconds % 60

    if hours > 0 {
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    return String(format: "%02d:%02d", minutes, seconds)
}

private func readableDurationSummary(_ elapsed: TimeInterval) -> String {
    readableElapsed(elapsed)
}

private func phoneFormatAmount(_ value: Double, unit: String) -> String {
    if unit == "ml" || unit == "g" || unit == "mm" {
        return "\(Int(value.rounded()))"
    }
    return String(format: "%.1f", value)
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255
        )
    }
}

enum PhoneServerMode: String, CaseIterable, Identifiable {
    case automatic
    case homeLAN
    case tailscale
    case none

    static let storageKey = "TinyNewbornLog.phoneServerMode"
    static let userSelectedStorageKey = "TinyNewbornLog.phoneServerModeUserSelected"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic: "Auto"
        case .homeLAN: "192"
        case .tailscale: "100"
        case .none: "None"
        }
    }

    var detail: String {
        switch self {
        case .automatic: "Try home and Tailscale"
        case .homeLAN: "Home Wi-Fi"
        case .tailscale: "Tailscale"
        case .none: "Offline test"
        }
    }

    static func applyDefaultIfNeeded() {
        let defaults = UserDefaults.standard
        defaults.register(defaults: [storageKey: PhoneServerMode.automatic.rawValue])

        if defaults.object(forKey: userSelectedStorageKey) == nil {
            defaults.set(PhoneServerMode.automatic.rawValue, forKey: storageKey)
            defaults.set(false, forKey: userSelectedStorageKey)
        }
    }
}

enum PhoneAppearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    static let storageKey = "TinyNewbornLog.phoneAppearance"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

enum PhoneLogKind: String, Codable, CaseIterable {
    case sleep
    case nursing
    case bottle
    case diaper
    case babyStats
    case bath
    case tummyTime
    case outdoorTime
    case babyGym
    case routines

    var title: String {
        switch self {
        case .sleep: "Sleep"
        case .nursing: "Boobie"
        case .bottle: "Bottle"
        case .diaper: "Wee & Poo"
        case .babyStats: "Baby Stats"
        case .bath: "Bath"
        case .tummyTime: "Tummy Time"
        case .outdoorTime: "Outdoor"
        case .babyGym: "Baby Gym"
        case .routines: "Routines"
        }
    }

    var symbolName: String {
        switch self {
        case .sleep: "moon.zzz.fill"
        case .nursing: "heart.fill"
        case .bottle: "drop.fill"
        case .diaper: "drop.triangle.fill"
        case .babyStats: "ruler.fill"
        case .bath: "bathtub.fill"
        case .tummyTime: "figure.child"
        case .outdoorTime: "sun.max.fill"
        case .babyGym: "figure.play"
        case .routines: "checklist"
        }
    }
}

enum PhoneNursingSide: String, Codable, CaseIterable, Identifiable {
    case left = "Left"
    case right = "Right"
    var id: String { rawValue }
}

enum PhoneDiaperEvent: String, Codable, CaseIterable, Identifiable {
    case wee = "Wee"
    case poo = "Poo"
    var id: String { rawValue }
}

struct PhonePoopColorOption: Identifiable, Hashable {
    let id: String
    let label: String
    let hex: UInt32
    let status: String

    static let all: [PhonePoopColorOption] = [
        .init(id: "mustard-yellow", label: "Mustard yellow", hex: 0xD8A21F, status: "Normal"),
        .init(id: "yellow", label: "Yellow", hex: 0xF2D35E, status: "Normal"),
        .init(id: "brown", label: "Brown", hex: 0x8A5A2B, status: "Normal"),
        .init(id: "green", label: "Green", hex: 0x557A35, status: "Normal"),
        .init(id: "tan", label: "Tan", hex: 0xC59055, status: "Normal"),
        .init(id: "dark-brown-black", label: "Dark brown/black", hex: 0x2D2118, status: "Check"),
        .init(id: "red-blood", label: "Red/blood", hex: 0xB3261E, status: "Call"),
        .init(id: "white-pale-gray", label: "White/pale gray", hex: 0xD8D2C2, status: "Urgent")
    ]

    static func label(for id: String?) -> String? {
        guard let id else { return nil }
        return all.first { $0.id == id }?.label
    }
}

enum PhoneRoutineKind: String, Codable, CaseIterable, Identifiable {
    case morning = "Morning routine"
    case naptime = "Naptime routine"
    case bedtime = "Bedtime routine"

    var id: String { rawValue }

    var payloadValue: String {
        switch self {
        case .morning: "morning"
        case .naptime: "naptime"
        case .bedtime: "bedtime"
        }
    }
}

enum PhoneMeasurementKind: String, Codable, CaseIterable, Identifiable {
    case weight = "Weight"
    case height = "Height"

    var id: String { rawValue }

    var unit: String {
        switch self {
        case .weight: "lb"
        case .height: "in"
        }
    }
}

struct PhoneUnitSettings: Codable, Equatable {
    var milkUnit: String = "ml"
    var weightUnit: String = "lb"
    var heightUnit: String = "in"

    init(milkUnit: String = "ml", weightUnit: String = "lb", heightUnit: String = "in") {
        self.milkUnit = ["ml", "oz"].contains(milkUnit) ? milkUnit : "ml"
        self.weightUnit = ["oz", "lb", "g", "kg"].contains(weightUnit) ? weightUnit : "lb"
        self.heightUnit = ["in", "ft", "cm", "mm"].contains(heightUnit) ? heightUnit : "in"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            milkUnit: try container.decodeIfPresent(String.self, forKey: .milkUnit) ?? "ml",
            weightUnit: try container.decodeIfPresent(String.self, forKey: .weightUnit) ?? "lb",
            heightUnit: try container.decodeIfPresent(String.self, forKey: .heightUnit) ?? "in"
        )
    }

    func unit(for kind: PhoneMeasurementKind) -> String {
        switch kind {
        case .weight: return weightUnit
        case .height: return heightUnit
        }
    }
}

enum PhoneBottleMilkType: String, Codable, CaseIterable, Identifiable {
    case formula = "Formula"
    case breastMilk = "Breast Milk"

    var id: String { rawValue }

    var payloadValue: String {
        switch self {
        case .formula: "formula"
        case .breastMilk: "breast_milk"
        }
    }

    static func fromPayload(_ value: String?) -> PhoneBottleMilkType {
        switch value {
        case "breast_milk", "breast milk", "Breast Milk": .breastMilk
        default: .formula
        }
    }
}

enum PhoneLogSyncState: String, Codable, Hashable {
    case pending
    case synced
}

struct PhoneLogEntry: Identifiable, Codable, Hashable {
    let id: UUID
    var remoteID: String?
    var kind: PhoneLogKind
    var startedAt: Date
    var endedAt: Date?
    var side: PhoneNursingSide?
    var amount: Double?
    var detail: String?
    var unit: String?
    var milkType: PhoneBottleMilkType?
    var poopColorID: String?
    var syncState: PhoneLogSyncState

    init(
        id: UUID = UUID(),
        remoteID: String? = nil,
        kind: PhoneLogKind,
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        side: PhoneNursingSide? = nil,
        amount: Double? = nil,
        detail: String? = nil,
        unit: String? = nil,
        milkType: PhoneBottleMilkType? = nil,
        poopColorID: String? = nil,
        syncState: PhoneLogSyncState = .pending
    ) {
        self.id = id
        self.remoteID = remoteID
        self.kind = kind
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.side = side
        self.amount = amount
        self.detail = detail
        self.unit = unit
        self.milkType = milkType
        self.poopColorID = poopColorID
        self.syncState = syncState
    }

    var durationSeconds: TimeInterval {
        max((endedAt ?? Date()).timeIntervalSince(startedAt), 0)
    }
}

struct PhonePendingSyncItem: Identifiable, Codable, Hashable {
    let id: UUID
    var entryID: UUID?
    var remoteID: String?
    var method: String?
    var title: String
    var createdAt: Date
    var body: Data

    init(id: UUID = UUID(), entryID: UUID? = nil, remoteID: String? = nil, method: String? = nil, title: String = "Log", createdAt: Date = Date(), body: Data) {
        self.id = id
        self.entryID = entryID
        self.remoteID = remoteID
        self.method = method
        self.title = title
        self.createdAt = createdAt
        self.body = body
    }
}

struct PhoneContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var store = PhoneLogStore()
    @AppStorage(PhoneAppearance.storageKey) private var appearanceRaw = PhoneAppearance.system.rawValue
    @State private var activeSheet: PhoneLoggerSheet?
    @State private var bottleML = 60.0
    @State private var bottleMilkType: PhoneBottleMilkType = .formula
    @State private var measurementKind: PhoneMeasurementKind = .weight
    @State private var measurementValue = 8.0
    @State private var selectedLogFilter: PhoneLogKind?
    private let syncRefreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    private var appearance: PhoneAppearance {
        PhoneAppearance(rawValue: appearanceRaw) ?? .system
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header

                    LazyVGrid(columns: columns, spacing: 10) {
                        sleepCard
                        boobieCard
                        bottleCard
                        diaperCard
                        statsCard
                        timedCard(.bath, color: .cyan)
                        timedCard(.tummyTime, color: .green)
                        timedCard(.outdoorTime, color: .yellow)
                        quickCard(.babyGym, color: .mint)
                        routinesCard
                    }

                    todayLogList
                }
                .padding()
            }
            .navigationBarHidden(true)
            .background(Color(.systemGroupedBackground))
            .sheet(item: $activeSheet) { sheet in
                sheetView(sheet)
                    .presentationDetents([.medium, .large])
            }
        }
        .preferredColorScheme(appearance.colorScheme)
        .task {
            await store.start()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.retryPendingSyncs(userInitiated: true) }
        }
        .onReceive(syncRefreshTimer) { _ in
            Task { await store.retryPendingSyncs() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image("AppLogo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 36, height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

                VStack(alignment: .leading, spacing: 1) {
                    Text("TinyNewbornLog")
                        .font(.title3.weight(.bold))
                    Text(store.lastLogMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button {
                    activeSheet = .settings
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.title3.weight(.semibold))
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await store.retryPendingSyncs(userInitiated: true) }
                } label: {
                    Image(systemName: store.pendingSyncCount > 0 ? "cloud.slash.fill" : "checkmark.circle.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(store.pendingSyncCount > 0 ? .blue : .green)
                }
                .buttonStyle(.bordered)
                .disabled(store.isSyncing)
            }

            if store.pendingSyncCount > 0 || store.isSyncing {
                HStack(spacing: 8) {
                    PendingHourglassIcon()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.syncStatus)
                            .font(.caption.weight(.semibold))
                        if !store.lastSyncError.isEmpty {
                            Text(store.lastSyncError)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                    Button("Sync") {
                        Task { await store.retryPendingSyncs(userInitiated: true) }
                    }
                    .font(.caption.weight(.semibold))
                }
                .padding(10)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    private var sleepCard: some View {
        let activeStartedAt = store.activeSleepStartedAt

        return PhoneLoggerCard(
            title: store.activeSleepStartedAt == nil ? "Sleep" : "Awake",
            value: activeStartedAt == nil ? store.todaysDurationText(for: .sleep) : "",
            subtitle: "today",
            symbolName: PhoneLogKind.sleep.symbolName,
            color: store.activeSleepStartedAt == nil ? .indigo : .orange,
            timerStartedAt: activeStartedAt
        ) {
            activeSheet = .sleep
        }
    }

    private var boobieCard: some View {
        PhoneLoggerCard(title: "Boobie", value: "\(store.todaysCount(for: .nursing))", subtitle: "feeds today", symbolName: PhoneLogKind.nursing.symbolName, color: .pink) {
            activeSheet = .boobie
        }
    }

    private var bottleCard: some View {
        PhoneLoggerCard(title: "Bottle", value: store.formatBottleAmount(fromML: store.todaysBottleML), subtitle: "today", symbolName: PhoneLogKind.bottle.symbolName, color: .teal) {
            activeSheet = .bottle
        }
    }

    private var diaperCard: some View {
        PhoneLoggerCard(title: "Wee & Poo", value: store.todaysDiaperSummary(), subtitle: "today", symbolName: PhoneLogKind.diaper.symbolName, color: .brown) {
            activeSheet = .diaper
        }
    }

    private var statsCard: some View {
        PhoneLoggerCard(
            title: "Baby Stats",
            value: store.latestStatsSummary(),
            subtitle: "latest",
            symbolName: PhoneLogKind.babyStats.symbolName,
            color: .blue
        ) {
            activeSheet = .babyStats
        }
    }

    private func timedCard(_ kind: PhoneLogKind, color: Color) -> some View {
        let startedAt = store.activeActivities[kind]
        return PhoneLoggerCard(
            title: kind.title,
            value: startedAt == nil ? store.todaysDurationText(for: kind) : "",
            subtitle: "today",
            symbolName: kind.symbolName,
            color: color,
            timerStartedAt: startedAt
        ) {
            activeSheet = .timed(kind)
        }
    }

    private func quickCard(_ kind: PhoneLogKind, color: Color) -> some View {
        PhoneLoggerCard(title: kind.title, value: "\(store.todaysCount(for: kind))", subtitle: "today", symbolName: kind.symbolName, color: color) {
            activeSheet = .quick(kind)
        }
    }

    private var routinesCard: some View {
        PhoneLoggerCard(title: "Routines", value: "\(store.todaysCount(for: .routines))", subtitle: "today", symbolName: PhoneLogKind.routines.symbolName, color: .purple) {
            activeSheet = .routines
        }
    }

    private var filteredTodayEntries: [PhoneLogEntry] {
        store.entriesForDay(offset: 0, matching: selectedLogFilter)
    }

    private var filteredYesterdayEntries: [PhoneLogEntry] {
        store.entriesForDay(offset: -1, matching: selectedLogFilter)
            .filter { yesterdayEntry in
                !filteredTodayEntries.contains { $0.id == yesterdayEntry.id }
            }
    }

    private var todayLogList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Today Log")
                    .font(.headline)

                Spacer()

                Menu {
                    Button("All") { selectedLogFilter = nil }
                    ForEach(PhoneLogKind.allCases, id: \.self) { kind in
                        Button(kind.title) { selectedLogFilter = kind }
                    }
                } label: {
                    Label(selectedLogFilter?.title ?? "All", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption.weight(.semibold))
                }
            }

            if filteredTodayEntries.isEmpty && filteredYesterdayEntries.isEmpty {
                Text("No logs yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                logSection(title: "Today", entries: filteredTodayEntries)

                if !filteredYesterdayEntries.isEmpty {
                    Divider()
                        .padding(.vertical, 4)
                    logSection(title: "Yesterday", entries: filteredYesterdayEntries)
                }
            }
        }
    }

    private func logSection(title: String, entries: [PhoneLogEntry]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            ForEach(entries) { entry in
                logRow(entry)
            }
        }
    }

    private func logRow(_ entry: PhoneLogEntry) -> some View {
        Button {
            activeSheet = .edit(entry)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: entry.kind.symbolName)
                    .foregroundStyle(color(for: entry.kind))
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.kind.title)
                        .font(.subheadline.weight(.semibold))
                    Text(store.detailText(for: entry))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if store.isPending(entry) {
                    PendingHourglassIcon()
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }

                VStack(alignment: .trailing, spacing: 2) {
                    Text(entryDisplayTime(entry), style: .time)
                    Text(entryDisplayTime(entry), format: .dateTime.month(.abbreviated).day())
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(10)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func entryDisplayTime(_ entry: PhoneLogEntry) -> Date {
        if entry.endedAt != nil, [.sleep, .bath, .tummyTime, .outdoorTime].contains(entry.kind) {
            return entry.startedAt
        }
        return entry.startedAt
    }

    @ViewBuilder
    private func sheetView(_ sheet: PhoneLoggerSheet) -> some View {
        switch sheet {
        case .sleep:
            PhoneDurationSheet(
                title: store.activeSleepStartedAt == nil ? "Sleep" : "Awake",
                detail: store.activeSleepStartedAt == nil ? "Baby awake" : "Sleeping now",
                buttonTitle: "Log",
                isActive: store.activeSleepStartedAt != nil,
                startedAt: store.activeSleepStartedAt,
                todayDuration: store.todaysDurationText(for: .sleep),
                lastDuration: store.lastCompletedDurationText(for: .sleep),
                lastEndedAt: store.lastCompletedDuration(for: .sleep)?.endedAt
            ) {
                store.toggleSleep()
                activeSheet = nil
            }
        case .boobie:
            PhoneChoiceSheet(title: "Boobie", detail: store.todaysTotalText(for: .nursing), lastDetail: store.lastDetail(for: .nursing), choices: PhoneNursingSide.allCases.map(\.rawValue)) { choice in
                store.logNursing(side: choice == "Right" ? .right : .left)
                activeSheet = nil
            }
        case .bottle:
            PhoneBottleSheet(amount: $bottleML, milkType: $bottleMilkType, totalToday: store.todaysTotalText(for: .bottle), lastDetail: store.lastDetail(for: .bottle), milkUnit: store.bottleDisplayUnit(), presetAmount: { milkType in
                store.latestBottleAmount(for: milkType)
            }) {
                store.logBottle(amountML: bottleML, milkType: bottleMilkType)
                activeSheet = nil
            }
            .onAppear {
                bottleML = store.latestBottleAmount(for: bottleMilkType)
            }
        case .diaper:
            PhoneDiaperSheet(totalToday: store.todaysTotalText(for: .diaper), lastDetail: store.lastDetail(for: .diaper)) { event, poopColor in
                store.logDiaper(event, poopColor: poopColor)
                activeSheet = nil
            }
        case .babyStats:
            PhoneStatsSheet(kind: $measurementKind, value: $measurementValue, totalToday: store.todaysTotalText(for: .babyStats), lastDetail: store.lastDetail(for: .babyStats), unitFor: { kind in
                store.measurementUnit(for: kind)
            }, presetValue: { kind in
                store.latestMeasurementValue(for: kind)
            }) {
                store.logMeasurement(kind: measurementKind, value: measurementValue)
                activeSheet = nil
            }
            .onAppear {
                measurementValue = store.latestMeasurementValue(for: measurementKind)
            }
        case .timed(let kind):
            PhoneDurationSheet(
                title: store.activeActivities[kind] == nil ? "Start \(kind.title)" : "End \(kind.title)",
                detail: store.activeActivities[kind].map { "Started \($0.formatted(date: .omitted, time: .shortened))" } ?? "Ready",
                buttonTitle: store.activeActivities[kind] == nil ? "Start" : "End",
                isActive: store.activeActivities[kind] != nil,
                startedAt: store.activeActivities[kind],
                todayDuration: store.todaysDurationText(for: kind),
                lastDuration: store.lastCompletedDurationText(for: kind),
                lastEndedAt: store.lastCompletedDuration(for: kind)?.endedAt
            ) {
                store.toggleTimedActivity(kind)
                activeSheet = nil
            }
        case .quick(let kind):
            PhoneConfirmSheet(title: kind.title, detail: store.todaysTotalText(for: kind), lastDetail: store.lastDetail(for: kind), buttonTitle: "Log") {
                store.logQuickActivity(kind)
                activeSheet = nil
            }
        case .routines:
            PhoneChoiceSheet(title: "Routines", detail: store.todaysTotalText(for: .routines), lastDetail: store.lastDetail(for: .routines), choices: PhoneRoutineKind.allCases.map(\.rawValue)) { choice in
                let routine = PhoneRoutineKind.allCases.first { $0.rawValue == choice } ?? .morning
                store.logRoutine(routine)
                activeSheet = nil
            }
        case .settings:
            PhoneSettingsSheet()
        case .edit(let entry):
            PhoneEditLogSheet(
                entry: entry,
                detailText: store.detailText(for: entry),
                milkUnit: store.bottleDisplayUnit(),
                weightUnit: store.measurementUnit(for: .weight),
                heightUnit: store.measurementUnit(for: .height)
            ) { updated in
                Task { await store.relog(updated) }
                activeSheet = nil
            } onDelete: { entry in
                Task { await store.remove(entry) }
                activeSheet = nil
            }
        }
    }

    private func color(for kind: PhoneLogKind) -> Color {
        switch kind {
        case .sleep: .indigo
        case .nursing: .pink
        case .bottle: .teal
        case .diaper: .brown
        case .babyStats: .blue
        case .bath: .cyan
        case .tummyTime: .green
        case .outdoorTime: .yellow
        case .babyGym: .mint
        case .routines: .purple
        }
    }
}

private enum PhoneLoggerSheet: Identifiable {
    case sleep
    case boobie
    case bottle
    case diaper
    case babyStats
    case timed(PhoneLogKind)
    case quick(PhoneLogKind)
    case routines
    case settings
    case edit(PhoneLogEntry)

    var id: String {
        switch self {
        case .sleep: "sleep"
        case .boobie: "boobie"
        case .bottle: "bottle"
        case .diaper: "diaper"
        case .babyStats: "babyStats"
        case .timed(let kind): "timed-\(kind.rawValue)"
        case .quick(let kind): "quick-\(kind.rawValue)"
        case .routines: "routines"
        case .settings: "settings"
        case .edit(let entry): "edit-\(entry.id.uuidString)"
        }
    }
}

private struct PhoneLoggerCard: View {
    var title: String
    var value: String
    var subtitle: String
    var symbolName: String
    var color: Color
    var timerStartedAt: Date? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: symbolName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.black)
                    .frame(width: 38, height: 38)
                    .background(color, in: Circle())

                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    if !value.isEmpty {
                        Text(value)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                    } else if let timerStartedAt {
                        TimelineView(.periodic(from: .now, by: 1)) { timeline in
                            Text(readableDurationSummary(timeline.date.timeIntervalSince(timerStartedAt)))
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                                .monospacedDigit()
                        }
                    }
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 128, alignment: .leading)
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(color.opacity(0.34), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct PendingHourglassIcon: View {
    @State private var isFlipped = false

    var body: some View {
        ZStack {
            Image(systemName: "arrow.clockwise.circle")
                .font(.body.weight(.bold))
            Image(systemName: "hourglass")
                .font(.system(size: 10, weight: .bold))
                .rotationEffect(.degrees(isFlipped ? 180 : 0))
                .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: false), value: isFlipped)
        }
        .foregroundStyle(.orange)
        .onAppear { isFlipped = true }
    }
}

private struct PhoneConfirmSheet: View {
    let title: String
    let detail: String
    var lastDetail: String? = nil
    let buttonTitle: String
    let onConfirm: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Text(detail)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if let lastDetail {
                    Label(lastDetail, systemImage: "clock.arrow.circlepath")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Button(buttonTitle, action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
            .padding()
            .navigationTitle(title)
        }
    }
}

private struct PhoneDurationSheet: View {
    let title: String
    let detail: String
    let buttonTitle: String
    let isActive: Bool
    let startedAt: Date?
    let todayDuration: String
    let lastDuration: String
    let lastEndedAt: Date?
    let onConfirm: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(detail, systemImage: "clock")
                        .foregroundStyle(.secondary)

                    if isActive, let startedAt {
                        PhoneElapsedTimerRow(startedAt: startedAt)
                    }
                }

                Section {
                    PhoneDurationSummaryRow(title: "Today", systemImage: "sum", value: todayDuration)
                    PhoneDurationSummaryRow(title: "Last", systemImage: "clock.arrow.circlepath", value: lastDuration, endedAt: lastEndedAt)
                }

                Button(action: onConfirm) {
                    Label(buttonTitle, systemImage: isActive ? "stop.fill" : "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .tint(isActive ? .orange : .green)
            }
            .navigationTitle(title)
        }
    }
}

private struct PhoneDurationSummaryRow: View {
    let title: String
    let systemImage: String
    let value: String
    var endedAt: Date? = nil

    var body: some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(value)
                    .font(.headline.weight(.semibold))
                    .monospacedDigit()
                if let endedAt {
                    Text(endedAt.formatted(date: .omitted, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct PhoneElapsedTimerRow: View {
    let startedAt: Date

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            HStack {
                Label("Timer", systemImage: "timer")
                Spacer()
                Text(readableDurationSummary(timeline.date.timeIntervalSince(startedAt)))
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
            }
        }
    }
}

private struct PhoneChoiceSheet: View {
    let title: String
    var detail: String?
    var lastDetail: String? = nil
    let choices: [String]
    let onChoose: (String) -> Void

    var body: some View {
        NavigationStack {
            List {
                if let detail {
                    Label(detail, systemImage: "sum")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let lastDetail {
                    Label(lastDetail, systemImage: "clock.arrow.circlepath")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ForEach(choices, id: \.self) { choice in
                    Button {
                        onChoose(choice)
                    } label: {
                        Text(choice)
                            .font(.title3.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle(title)
        }
    }
}

private struct PhoneDiaperSheet: View {
    let totalToday: String
    let lastDetail: String
    let onLog: (PhoneDiaperEvent, PhonePoopColorOption?) -> Void

    var body: some View {
        NavigationStack {
            List {
                Label(totalToday, systemImage: "sum")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Label(lastDetail, systemImage: "clock.arrow.circlepath")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Button {
                    onLog(.wee, nil)
                } label: {
                    Label("Wee", systemImage: "drop.fill")
                        .font(.title3.weight(.semibold))
                        .padding(.vertical, 8)
                }
                .tint(.yellow)

                Section("Poo color") {
                    ForEach(PhonePoopColorOption.all) { option in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color(hex: option.hex))
                                .frame(width: 32, height: 32)
                                .overlay(Circle().strokeBorder(.secondary.opacity(0.25), lineWidth: 1))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.label)
                                    .font(.headline)
                                Text(option.status)
                                    .font(.caption)
                                    .foregroundStyle(statusColor(option.status))
                            }

                            Spacer()

                            Button("Log") {
                                onLog(.poo, option)
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
            .navigationTitle("Wee & Poo")
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "Call", "Urgent": return .red
        case "Check": return .orange
        default: return .secondary
        }
    }
}

private struct PhoneEditLogSheet: View {
    @State private var entry: PhoneLogEntry
    @State private var eventDate: Date
    @State private var amount: Double
    @State private var side: PhoneNursingSide
    @State private var milkType: PhoneBottleMilkType
    @State private var poopColorID: String
    @State private var measurementKind: PhoneMeasurementKind
    let detailText: String
    let milkUnit: String
    let weightUnit: String
    let heightUnit: String
    let onRelog: (PhoneLogEntry) -> Void
    let onDelete: (PhoneLogEntry) -> Void

    init(entry: PhoneLogEntry, detailText: String, milkUnit: String, weightUnit: String, heightUnit: String, onRelog: @escaping (PhoneLogEntry) -> Void, onDelete: @escaping (PhoneLogEntry) -> Void) {
        let measurementKind: PhoneMeasurementKind = entry.detail == "Height" ? .height : .weight
        let sourceUnit = entry.unit ?? measurementKind.unit
        let displayAmount: Double
        if entry.kind == .bottle {
            displayAmount = milkUnit == "oz" ? ((entry.amount ?? 0) / 29.5735 * 100).rounded() / 100 : (entry.amount ?? 0)
        } else if entry.kind == .babyStats, measurementKind == .height {
            displayAmount = phoneConvertHeight(entry.amount ?? 0, from: sourceUnit, to: heightUnit)
        } else if entry.kind == .babyStats {
            displayAmount = phoneConvertWeight(entry.amount ?? 0, from: sourceUnit, to: weightUnit)
        } else {
            displayAmount = entry.amount ?? 0
        }

        self._entry = State(initialValue: entry)
        self._eventDate = State(initialValue: entry.endedAt ?? entry.startedAt)
        self._amount = State(initialValue: displayAmount)
        self._side = State(initialValue: entry.side ?? .left)
        self._milkType = State(initialValue: entry.milkType ?? PhoneBottleMilkType.fromPayload(entry.detail))
        self._poopColorID = State(initialValue: entry.poopColorID ?? PhonePoopColorOption.all.first?.id ?? "")
        self._measurementKind = State(initialValue: measurementKind)
        self.detailText = detailText
        self.milkUnit = milkUnit
        self.weightUnit = weightUnit
        self.heightUnit = heightUnit
        self.onRelog = onRelog
        self.onDelete = onDelete
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(entry.kind.title) {
                    Text(detailText)
                        .foregroundStyle(.secondary)

                    DatePicker("Time", selection: $eventDate, displayedComponents: [.date, .hourAndMinute])
                }

                switch entry.kind {
                case .nursing:
                    Picker("Side", selection: $side) {
                        ForEach(PhoneNursingSide.allCases) { side in
                            Text(side.rawValue).tag(side)
                        }
                    }
                case .bottle:
                    Picker("Milk", selection: $milkType) {
                        ForEach(PhoneBottleMilkType.allCases) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    Stepper(value: $amount, in: bottleBounds, step: bottleStep) {
                        Text("\(phoneFormatAmount(amount, unit: milkUnit)) \(milkUnit)")
                    }
                case .diaper:
                    Picker("Kind", selection: $entry.detail) {
                        Text("Wee").tag(Optional("Wee"))
                        Text("Poo").tag(Optional("Poo"))
                    }
                    if entry.detail != "Wee" {
                        Picker("Color", selection: $poopColorID) {
                            ForEach(PhonePoopColorOption.all) { option in
                                Text(option.label).tag(option.id)
                            }
                        }
                    }
                case .babyStats:
                    Picker("Type", selection: $measurementKind) {
                        ForEach(PhoneMeasurementKind.allCases) { kind in
                            Text(kind.rawValue).tag(kind)
                        }
                    }
                    Stepper(value: $amount, in: measurementBounds, step: measurementStep) {
                        Text("\(phoneFormatAmount(amount, unit: measurementUnit)) \(measurementUnit)")
                    }
                default:
                    EmptyView()
                }

                Button("Relog") {
                    var updated = entry
                    if updated.endedAt != nil, [.sleep, .bath, .tummyTime, .outdoorTime].contains(updated.kind) {
                        updated.endedAt = eventDate
                    } else {
                        updated.startedAt = eventDate
                    }
                    updated.amount = amount > 0 ? amount : updated.amount
                    updated.side = updated.kind == .nursing ? side : updated.side
                    if updated.kind == .bottle {
                        updated.amount = milkUnit == "oz" ? amount * 29.5735 : amount
                        updated.unit = "ml"
                        updated.milkType = milkType
                        updated.detail = milkType.rawValue
                    }
                    if updated.kind == .diaper {
                        let isWee = updated.detail == "Wee"
                        updated.poopColorID = isWee ? nil : poopColorID
                        updated.detail = isWee ? "Wee" : PhonePoopColorOption.label(for: poopColorID).map { "Poo: \($0)" } ?? "Poo"
                    }
                    if updated.kind == .babyStats {
                        updated.detail = measurementKind.rawValue
                        updated.unit = measurementUnit
                    }
                    onRelog(updated)
                }
                .buttonStyle(.borderedProminent)

                Button(role: .destructive) {
                    onDelete(entry)
                } label: {
                    Label("Remove Log", systemImage: "trash")
                }
            }
            .navigationTitle("Edit Log")
        }
    }

    private var bottleBounds: ClosedRange<Double> {
        milkUnit == "oz" ? 0.25...8 : 5...300
    }

    private var bottleStep: Double {
        milkUnit == "oz" ? 0.25 : 5
    }

    private var measurementUnit: String {
        measurementKind == .weight ? weightUnit : heightUnit
    }

    private var measurementBounds: ClosedRange<Double> {
        switch (measurementKind, measurementUnit) {
        case (.weight, "oz"): return 64...480
        case (.weight, "g"): return 1800...14000
        case (.weight, "kg"): return 1.8...14
        case (.height, "ft"): return 1.3...3.5
        case (.height, "cm"): return 40...100
        case (.height, "mm"): return 400...1000
        case (.height, _): return 16...40
        default: return 4...30
        }
    }

    private var measurementStep: Double {
        switch measurementUnit {
        case "g", "mm": return 10
        case "kg": return 0.1
        case "cm": return 0.5
        default: return 0.1
        }
    }
}

private struct PhoneBottleSheet: View {
    @Binding var amount: Double
    @Binding var milkType: PhoneBottleMilkType
    let totalToday: String
    let lastDetail: String
    let milkUnit: String
    let presetAmount: (PhoneBottleMilkType) -> Double
    let onLog: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(totalToday, systemImage: "sum")
                        .foregroundStyle(.secondary)
                    Label(lastDetail, systemImage: "clock.arrow.circlepath")
                        .foregroundStyle(.secondary)
                }
                Picker("Milk", selection: $milkType) {
                    ForEach(PhoneBottleMilkType.allCases) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .onChange(of: milkType) { _, newType in
                    amount = presetAmount(newType)
                }

                Section("Bottle") {
                    Stepper(value: $amount, in: step...maxAmount, step: step) {
                        Text("\(phoneFormatAmount(amount, unit: milkUnit)) \(milkUnit)")
                            .font(.title2.weight(.bold))
                    }
                }
                Button("Log Bottle", action: onLog)
                    .buttonStyle(.borderedProminent)
            }
            .navigationTitle("Bottle")
        }
    }

    private var step: Double {
        milkUnit == "oz" ? 0.25 : 5
    }

    private var maxAmount: Double {
        milkUnit == "oz" ? 8 : 300
    }
}

private struct PhoneStatsSheet: View {
    @Binding var kind: PhoneMeasurementKind
    @Binding var value: Double
    let totalToday: String
    let lastDetail: String
    let unitFor: (PhoneMeasurementKind) -> String
    let presetValue: (PhoneMeasurementKind) -> Double
    let onLog: () -> Void

    private var unit: String {
        unitFor(kind)
    }

    private var bounds: ClosedRange<Double> {
        switch (kind, unit) {
        case (.weight, "oz"): return 64...480
        case (.weight, "g"): return 1800...14000
        case (.weight, "kg"): return 1.8...14
        case (.height, "ft"): return 1.3...3.5
        case (.height, "cm"): return 40...100
        case (.height, "mm"): return 400...1000
        case (.height, _): return 16...40
        default: return 4...30
        }
    }

    private var step: Double {
        switch unit {
        case "g", "mm": return 10
        case "kg": return 0.1
        case "cm": return 0.5
        default: return 0.1
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(totalToday, systemImage: "sum")
                        .foregroundStyle(.secondary)
                    Label(lastDetail, systemImage: "clock.arrow.circlepath")
                        .foregroundStyle(.secondary)
                }
                Picker("Type", selection: $kind) {
                    ForEach(PhoneMeasurementKind.allCases) { kind in
                        Text(kind.rawValue).tag(kind)
                    }
                }
                .onChange(of: kind) { _, newKind in
                    value = presetValue(newKind)
                }
                Section(kind.rawValue) {
                    Stepper(value: $value, in: bounds, step: step) {
                        Text("\(phoneFormatAmount(value, unit: unit)) \(unit)")
                            .font(.title2.weight(.bold))
                    }
                }
                Button("Log \(kind.rawValue)", action: onLog)
                    .buttonStyle(.borderedProminent)
            }
            .navigationTitle("Baby Stats")
        }
    }
}

private struct PhoneSettingsSheet: View {
    @AppStorage(PhoneServerMode.storageKey) private var serverModeRaw = PhoneServerMode.automatic.rawValue
    @AppStorage(PhoneAppearance.storageKey) private var appearance = PhoneAppearance.system

    var body: some View {
        NavigationStack {
            Form {
                Section("Sync server") {
                    Picker("Server", selection: serverModeBinding) {
                        ForEach(PhoneServerMode.allCases) { option in
                            Text("\(option.title) - \(option.detail)").tag(option)
                        }
                    }
                }

                Section("Appearance") {
                    Picker("Mode", selection: $appearance) {
                        ForEach(PhoneAppearance.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    Text("Use None to test offline behavior. Logs stay local and sync later.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
    }

    private var serverModeBinding: Binding<PhoneServerMode> {
        Binding {
            PhoneServerMode(rawValue: serverModeRaw) ?? .automatic
        } set: { newValue in
            serverModeRaw = newValue.rawValue
            UserDefaults.standard.set(true, forKey: PhoneServerMode.userSelectedStorageKey)
        }
    }
}

@MainActor
final class PhoneLogStore: ObservableObject {
    @Published private(set) var entries: [PhoneLogEntry] = []
    @Published private(set) var activeSleepStartedAt: Date?
    @Published private(set) var activeActivities: [PhoneLogKind: Date] = [:]
    @Published private(set) var syncStatus = "Ready"
    @Published private(set) var lastLogMessage = "Ready"
    @Published private(set) var lastSyncError = ""
    @Published private(set) var pendingSyncCount = 0
    @Published private(set) var isSyncing = false
    @Published private(set) var unitSettings = PhoneUnitSettings()

    private let activeSleepKey = "TinyNewbornLog.phone.activeSleepStartedAt"
    private let activeActivitiesKey = "TinyNewbornLog.phone.activeActivities"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var pendingItems: [PhonePendingSyncItem] = []
    private var syncTask: Task<Void, Never>?

    init() {
        PhoneServerMode.applyDefaultIfNeeded()
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
        loadEntries()
        loadActiveSleep()
        loadActiveActivities()
        loadPendingItems()
        pruneCachedEntries()
        updatePendingStatus()
    }

    var todaysEntries: [PhoneLogEntry] {
        todayEntries(matching: nil)
    }

    var recentEntries: [PhoneLogEntry] {
        Array(entries.prefix(20))
    }

    var todaysBottleML: Double {
        todaysEntries.compactMap { $0.kind == .bottle ? $0.amount : nil }.reduce(0, +)
    }

    func latestEntry(for kind: PhoneLogKind) -> PhoneLogEntry? {
        entries.filter { $0.kind == kind }.sorted { $0.startedAt > $1.startedAt }.first
    }

    func latestBottleAmount(for milkType: PhoneBottleMilkType) -> Double {
        let amountML = entries
            .filter { $0.kind == .bottle && ($0.milkType ?? PhoneBottleMilkType.fromPayload($0.detail)) == milkType }
            .sorted { $0.startedAt > $1.startedAt }
            .first?.amount ?? 60
        return displayBottleAmount(fromML: amountML)
    }

    func latestMeasurementValue(for kind: PhoneMeasurementKind) -> Double {
        let latest = entries
            .filter { $0.kind == .babyStats && $0.detail == kind.rawValue }
            .sorted { $0.startedAt > $1.startedAt }
            .first

        guard let entry = latest, let value = entry.amount else {
            return kind == .weight ? displayWeight(8.0, from: "lb") : displayHeight(20.0, from: "in")
        }
        return kind == .weight
            ? displayWeight(value, from: entry.unit ?? "lb")
            : displayHeight(value, from: entry.unit ?? "in")
    }

    func todaysTotalText(for kind: PhoneLogKind) -> String {
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

    func measurementUnit(for kind: PhoneMeasurementKind) -> String {
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
            return "\(PhoneNumberFormatter.shortDecimal.string(from: NSNumber(value: amount)) ?? "\(amount)") oz"
        }
        return "\(Int(amount.rounded())) ml"
    }

    func displayWeight(_ value: Double, from unit: String) -> Double {
        phoneConvertWeight(value, from: unit, to: unitSettings.weightUnit)
    }

    func displayHeight(_ value: Double, from unit: String) -> Double {
        phoneConvertHeight(value, from: unit, to: unitSettings.heightUnit)
    }

    private func latestMeasurementSummary(for kind: PhoneMeasurementKind) -> String? {
        let unit = measurementUnit(for: kind)
        let latest = entries
            .filter { $0.kind == .babyStats && $0.detail == kind.rawValue }
            .sorted { $0.startedAt > $1.startedAt }
            .first

        guard let latest, let value = latest.amount else {
            return nil
        }

        let sourceUnit = latest.unit ?? kind.unit
        let displayValue = kind == .weight
            ? phoneConvertWeight(value, from: sourceUnit, to: unit)
            : phoneConvertHeight(value, from: sourceUnit, to: unit)
        let formatted = PhoneNumberFormatter.shortDecimal.string(from: NSNumber(value: displayValue)) ?? "\(displayValue)"
        return "\(formatted) \(unit)"
    }

    func lastSummary(for kind: PhoneLogKind) -> String {
        guard let entry = latestEntry(for: kind) else {
            return "Last time: none"
        }
        return "Last: \(entry.startedAt.formatted(date: .abbreviated, time: .shortened)) \(detailText(for: entry))"
    }

    func lastDetail(for kind: PhoneLogKind) -> String {
        guard let entry = latestEntry(for: kind) else {
            return "No previous log"
        }

        return "\(entry.startedAt.formatted(date: .abbreviated, time: .shortened)) \(detailText(for: entry))"
    }

    func start() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        await retryPendingSyncs()
    }

    func todaysCount(for kind: PhoneLogKind) -> Int {
        todayEntries(matching: kind).count
    }

    func todaysDurationSeconds(for kind: PhoneLogKind) -> TimeInterval {
        let completed = entries
            .filter { $0.kind == kind && $0.endedAt != nil }
            .reduce(0) { $0 + clippedDuration($1, inDayOffset: 0) }

        return completed + activeDurationSeconds(for: kind, inDayOffset: 0)
    }

    func todaysDurationText(for kind: PhoneLogKind) -> String {
        formatDuration(todaysDurationSeconds(for: kind))
    }

    func lastCompletedDuration(for kind: PhoneLogKind) -> (startedAt: Date, endedAt: Date, seconds: TimeInterval)? {
        entries
            .filter { $0.kind == kind && $0.endedAt != nil }
            .sorted { ($0.endedAt ?? $0.startedAt) > ($1.endedAt ?? $1.startedAt) }
            .first
            .flatMap { entry in
                guard let endedAt = entry.endedAt else { return nil }
                return (entry.startedAt, endedAt, entry.durationSeconds)
            }
    }

    func lastCompletedDurationText(for kind: PhoneLogKind) -> String {
        guard let last = lastCompletedDuration(for: kind) else {
            return "0m"
        }

        return formatDuration(last.seconds)
    }

    func todayEntries(matching filter: PhoneLogKind?) -> [PhoneLogEntry] {
        entriesForDay(offset: 0, matching: filter)
    }

    func entriesForDay(offset: Int, matching filter: PhoneLogKind?) -> [PhoneLogEntry] {
        entries
            .filter { entry in
                (filter == nil || entry.kind == filter) && isVisible(entry, inDayOffset: offset)
            }
            .sorted { $0.startedAt > $1.startedAt }
    }

    func toggleSleep() {
        if let startedAt = activeSleepStartedAt {
            let entry = addEntry(PhoneLogEntry(kind: .sleep, startedAt: startedAt, endedAt: Date()))
            activeSleepStartedAt = nil
            UserDefaults.standard.removeObject(forKey: activeSleepKey)
            enqueue(["type": "sleep", "status": "awake", "notes": "Baby woke up"], entryID: entry.id, title: "Awake")
        } else {
            let now = Date()
            activeSleepStartedAt = now
            UserDefaults.standard.set(now.timeIntervalSince1970, forKey: activeSleepKey)
            let entry = addEntry(PhoneLogEntry(kind: .sleep, startedAt: now, detail: "Started"))
            enqueue(["type": "sleep", "status": "asleep", "notes": "Baby fell asleep"], entryID: entry.id, title: "Sleep")
        }
    }

    func logNursing(side: PhoneNursingSide) {
        let entry = addEntry(PhoneLogEntry(kind: .nursing, side: side))
        enqueue(["type": "feeding", "method": "breast", "side": side == .right ? "right" : "left", "notes": "Started on \(side.rawValue.lowercased()) side"], entryID: entry.id, title: "\(side.rawValue) boobie")
        Task {
            await notifyBoobieReminder(after: side)
        }
    }

    func logBottle(amountML: Double, milkType: PhoneBottleMilkType) {
        let storedML = bottleML(fromDisplayAmount: amountML)
        let entry = addEntry(PhoneLogEntry(kind: .bottle, amount: storedML, detail: milkType.rawValue, unit: "ml", milkType: milkType))
        let ounces = (storedML / 29.5735 * 100).rounded() / 100
        enqueue(["type": "bottle", "ounces": ounces, "milkType": milkType.payloadValue, "notes": "\(milkType.rawValue) bottle feed"], entryID: entry.id, title: "\(formatBottleAmount(fromML: storedML)) \(milkType.rawValue)")
    }

    func logDiaper(_ event: PhoneDiaperEvent, poopColor: PhonePoopColorOption? = nil) {
        let detail = poopColor.map { "Poo: \($0.label)" } ?? event.rawValue
        let entry = addEntry(PhoneLogEntry(kind: .diaper, detail: detail, poopColorID: poopColor?.id))
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
        enqueue(payload, entryID: entry.id, title: detail)
    }

    func logMeasurement(kind: PhoneMeasurementKind, value: Double) {
        let unit = measurementUnit(for: kind)
        let entry = addEntry(PhoneLogEntry(kind: .babyStats, amount: value, detail: kind.rawValue, unit: unit))
        if kind == .weight {
            enqueue(["type": "growth_stats", "stat": "weight", "weight": value, "weightUnit": unit, "notes": "\(kind.rawValue): \(value) \(unit)"], entryID: entry.id, title: "Weight")
        } else {
            enqueue(["type": "growth_stats", "stat": "height", "height": value, "heightUnit": unit, "notes": "\(kind.rawValue): \(value) \(unit)"], entryID: entry.id, title: "Height")
        }
    }

    func toggleTimedActivity(_ kind: PhoneLogKind) {
        if let startedAt = activeActivities[kind] {
            let entry = addEntry(PhoneLogEntry(kind: kind, startedAt: startedAt, endedAt: Date(), detail: "Ended"))
            activeActivities.removeValue(forKey: kind)
            saveActiveActivities()
            enqueue(["type": webType(for: kind), "status": "end", "notes": "\(kind.title) end"], entryID: entry.id, title: "\(kind.title) end")
        } else {
            let now = Date()
            activeActivities[kind] = now
            saveActiveActivities()
            let entry = addEntry(PhoneLogEntry(kind: kind, startedAt: now, detail: "Started"))
            enqueue(["type": webType(for: kind), "status": "start", "notes": "\(kind.title) start"], entryID: entry.id, title: "\(kind.title) start")
        }
    }

    func logQuickActivity(_ kind: PhoneLogKind) {
        let entry = addEntry(PhoneLogEntry(kind: kind))
        enqueue(["type": webType(for: kind), "notes": "\(kind.title) logged"], entryID: entry.id, title: kind.title)
    }

    func logRoutine(_ routine: PhoneRoutineKind) {
        let entry = addEntry(PhoneLogEntry(kind: .routines, detail: routine.rawValue))
        enqueue(["type": "routine", "routine": routine.payloadValue, "notes": "\(routine.rawValue) done"], entryID: entry.id, title: routine.rawValue)
    }

    func detailText(for entry: PhoneLogEntry) -> String {
        switch entry.kind {
        case .sleep:
            return entry.endedAt == nil ? (entry.detail ?? "Started") : formatDuration(entry.durationSeconds)
        case .nursing:
            return entry.side?.rawValue ?? "Side"
        case .bottle:
            let type = entry.milkType?.rawValue ?? entry.detail ?? "Milk"
            return "\(formatBottleAmount(fromML: entry.amount ?? 0)) \(type)"
        case .diaper:
            if let label = PhonePoopColorOption.label(for: entry.poopColorID) {
                return "Poo: \(label)"
            }
            return entry.detail ?? "Logged"
        case .babyStats:
            let isHeight = entry.detail == "Height"
            let unit = measurementUnit(for: isHeight ? .height : .weight)
            let sourceUnit = entry.unit ?? (isHeight ? "in" : "lb")
            let displayValue = entry.amount.map {
                isHeight ? phoneConvertHeight($0, from: sourceUnit, to: unit) : phoneConvertWeight($0, from: sourceUnit, to: unit)
            }
            let value = displayValue.map { PhoneNumberFormatter.shortDecimal.string(from: NSNumber(value: $0)) ?? "\($0)" } ?? ""
            return "\(entry.detail ?? "Value") \(value) \(unit)"
        case .bath, .tummyTime, .outdoorTime:
            return entry.endedAt == nil ? (entry.detail ?? "Started") : formatDuration(entry.durationSeconds)
        case .babyGym:
            return "Logged"
        case .routines:
            return entry.detail ?? "Done"
        }
    }

    func isPending(_ entry: PhoneLogEntry) -> Bool {
        entry.syncState == .pending || pendingItems.contains { $0.entryID == entry.id }
    }

    func relog(_ updated: PhoneLogEntry) async {
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
            lastSyncError = "Could not relog"
            updatePendingStatus()
            return
        }

        if let pendingIndex = pendingItems.firstIndex(where: { $0.entryID == next.id }) {
            if pendingItems[pendingIndex].method == "PUT" {
                pendingItems[pendingIndex].body = body
            } else {
                pendingItems[pendingIndex].body = createBody(for: next)
            }
            pendingItems[pendingIndex].title = "Relog \(next.kind.title)"
            savePendingItems()
            updatePendingStatus()
            scheduleSync(after: 1)
            return
        }

        guard let remoteID = next.remoteID else {
            pendingItems.append(PhonePendingSyncItem(entryID: next.id, title: "Relog \(next.kind.title)", body: createBody(for: next)))
            savePendingItems()
            updatePendingStatus()
            scheduleSync(after: 1)
            return
        }

        do {
            try await PhoneLogSyncClient.shared.updateLog(remoteID: remoteID, body: body)
            markEntrySynced(next.id)
            lastLogMessage = "Relogged on server"
            lastSyncError = ""
            await pullServerLogs()
        } catch {
            pendingItems.append(PhonePendingSyncItem(entryID: next.id, remoteID: remoteID, method: "PUT", title: "Relog \(next.kind.title)", body: body))
            savePendingItems()
            lastSyncError = error.localizedDescription
            updatePendingStatus()
            scheduleSync(after: 30)
        }
    }

    func remove(_ entry: PhoneLogEntry) async {
        entries.removeAll { $0.id == entry.id }
        pendingItems.removeAll { $0.entryID == entry.id && $0.method != "DELETE" }
        saveEntries()
        savePendingItems()
        lastLogMessage = "Removed locally"

        guard let remoteID = entry.remoteID else {
            updatePendingStatus()
            return
        }

        do {
            try await PhoneLogSyncClient.shared.deleteLog(remoteID: remoteID)
            lastLogMessage = "Removed on server"
            lastSyncError = ""
            updatePendingStatus()
            await pullServerLogs()
        } catch {
            pendingItems.append(PhonePendingSyncItem(entryID: entry.id, remoteID: remoteID, method: "DELETE", title: "Remove \(entry.kind.title)", body: Data()))
            savePendingItems()
            lastSyncError = error.localizedDescription
            updatePendingStatus()
            scheduleSync(after: 30)
        }
    }

    func retryPendingSyncs(userInitiated: Bool = false) async {
        syncTask?.cancel()
        syncTask = nil

        guard !isSyncing, !pendingItems.isEmpty else {
            await pullServerLogs()
            updatePendingStatus()
            return
        }

        isSyncing = true
        syncStatus = "Syncing..."
        var synced: [PhonePendingSyncItem] = []

        while let item = pendingItems.first {
            do {
                if item.method == "DELETE", let remoteID = item.remoteID {
                    try await PhoneLogSyncClient.shared.deleteLog(remoteID: remoteID)
                } else if item.method == "PUT", let remoteID = item.remoteID {
                    try await PhoneLogSyncClient.shared.updateLog(remoteID: remoteID, body: item.body)
                } else {
                    try await PhoneLogSyncClient.shared.postLogData(item.body)
                }
                pendingItems.removeFirst()
                markEntrySynced(item.entryID)
                synced.append(item)
                savePendingItems()
            } catch {
                lastSyncError = error.localizedDescription
                break
            }
        }

        isSyncing = false
        updatePendingStatus()

        if !synced.isEmpty {
            lastLogMessage = "Logged on server"
            lastSyncError = ""
            await pullServerLogs()
            await notifyTransferredLogs(synced)
        } else if !userInitiated, !pendingItems.isEmpty {
            scheduleSync(after: 30)
        }
    }

    @discardableResult
    private func addEntry(_ entry: PhoneLogEntry) -> PhoneLogEntry {
        var local = entry
        local.syncState = .pending
        entries.insert(local, at: 0)
        saveEntries()
        lastLogMessage = "Logged locally"
        return local
    }

    private func enqueue(_ payload: [String: Any], entryID: UUID, title: String) {
        var payloadWithID = payload
        payloadWithID["id"] = entryID.uuidString
        if let entry = entries.first(where: { $0.id == entryID }) {
            payloadWithID = payloadWithEventTime(payloadWithID, for: entry)
        }

        guard let body = try? JSONSerialization.data(withJSONObject: payloadWithID) else {
            syncStatus = "Sync failed"
            return
        }
        pendingItems.append(PhonePendingSyncItem(entryID: entryID, title: title, body: body))
        savePendingItems()
        updatePendingStatus()
        scheduleSync(after: 2)
    }

    private func payloadWithEventTime(_ payload: [String: Any], for entry: PhoneLogEntry) -> [String: Any] {
        var payload = payload
        let eventDate = serverEventDate(for: entry)
        payload["date"] = Self.payloadDateFormatter.string(from: eventDate)
        payload["time"] = Self.payloadTimeFormatter.string(from: eventDate)
        payload["createdAt"] = Self.payloadISOFormatter.string(from: eventDate)
        return payload
    }

    private func createBody(for entry: PhoneLogEntry) -> Data {
        var payload = createPayload(for: entry)
        payload["id"] = entry.id.uuidString
        return (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
    }

    private func scheduleSync(after seconds: UInt64) {
        guard !pendingItems.isEmpty else {
            return
        }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.retryPendingSyncs()
        }
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
            unitSettings = try await PhoneLogSyncClient.shared.fetchUnitSettings()
        } catch {
            // Keep the last known/default units when settings are unreachable.
        }

        do {
            let remoteLogs = try await PhoneLogSyncClient.shared.fetchLogs()
            mergeRemoteLogs(remoteLogs)
            lastSyncError = ""
        } catch {
            if pendingItems.isEmpty {
                lastSyncError = error.localizedDescription
            }
        }
    }

    private func mergeRemoteLogs(_ remoteLogs: [PhoneRemoteLog]) {
        var next = entries
        let pendingEntryIDs = Set(pendingItems.compactMap(\.entryID))
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

    private func pairedRemoteEntries(from remoteLogs: [PhoneRemoteLog]) -> [PhoneLogEntry] {
        let sorted = remoteLogs.sorted { $0.eventDate < $1.eventDate }
        var entries: [PhoneLogEntry] = []
        var openDurations: [String: PhoneRemoteLog] = [:]
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

    private func applyRemoteActiveState(_ remoteLogs: [PhoneRemoteLog]) {
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
        for kind in [PhoneLogKind.bath, .tummyTime, .outdoorTime] {
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

    private func webType(for kind: PhoneLogKind) -> String {
        switch kind {
        case .sleep: "sleep"
        case .nursing: "feeding"
        case .bottle: "bottle"
        case .diaper: "diaper"
        case .babyStats: "growth_stats"
        case .bath: "bath"
        case .tummyTime: "tummy_time"
        case .outdoorTime: "outdoor_time"
        case .babyGym: "baby_gym"
        case .routines: "routine"
        }
    }

    private func isVisibleInToday(_ entry: PhoneLogEntry) -> Bool {
        isVisible(entry, inDayOffset: 0)
    }

    private func isVisible(_ entry: PhoneLogEntry, inDayOffset offset: Int) -> Bool {
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

    private func clippedDuration(_ entry: PhoneLogEntry, inDayOffset offset: Int) -> TimeInterval {
        let range = dayRange(offset: offset)
        let startedAt = max(entry.startedAt, range.start)
        let endedAt = min(effectiveEndDate(for: entry), range.end)
        return max(endedAt.timeIntervalSince(startedAt), 0)
    }

    private func activeDurationSeconds(for kind: PhoneLogKind, inDayOffset offset: Int) -> TimeInterval {
        let startedAt: Date?
        if kind == .sleep {
            startedAt = activeSleepStartedAt
        } else {
            startedAt = activeActivities[kind]
        }

        guard let startedAt else {
            return 0
        }

        return clippedDuration(PhoneLogEntry(kind: kind, startedAt: startedAt, endedAt: Date(), syncState: .synced), inDayOffset: offset)
    }

    private func effectiveEndDate(for entry: PhoneLogEntry) -> Date {
        if let endedAt = entry.endedAt {
            return endedAt
        }

        return isActiveOpenEntry(entry) ? Date.distantFuture : entry.startedAt
    }

    private func isActiveOpenEntry(_ entry: PhoneLogEntry) -> Bool {
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
        let pendingEntryIDs = Set(pendingItems.compactMap(\.entryID))
        entries = entries.filter { entry in
            pendingEntryIDs.contains(entry.id)
                || isVisible(entry, inDayOffset: 0)
                || isVisible(entry, inDayOffset: -1)
                || isActiveOpenEntry(entry)
        }
    }

    private func isDurationKind(_ kind: PhoneLogKind) -> Bool {
        [.sleep, .bath, .tummyTime, .outdoorTime].contains(kind)
    }

    private func updatePayload(for entry: PhoneLogEntry) -> [String: Any] {
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
            payload["ounces"] = ((entry.amount ?? 0) / 29.5735 * 100).rounded() / 100
            payload["milkType"] = (entry.milkType ?? PhoneBottleMilkType.fromPayload(entry.detail)).payloadValue
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
                payload["height"] = entry.amount ?? 0
                payload["heightUnit"] = entry.unit ?? "in"
            } else {
                payload["stat"] = "weight"
                payload["weight"] = entry.amount ?? 0
                payload["weightUnit"] = entry.unit ?? "lb"
            }
        case .bath, .tummyTime, .outdoorTime:
            payload["status"] = entry.endedAt == nil ? "start" : "end"
        case .babyGym, .routines:
            break
        }

        return payload
    }

    private func createPayload(for entry: PhoneLogEntry) -> [String: Any] {
        var payload = updatePayload(for: entry)
        payload["type"] = webType(for: entry.kind)

        if entry.kind == .nursing {
            payload["method"] = "breast"
        }

        return payload
    }

    private func serverEventDate(for entry: PhoneLogEntry) -> Date {
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

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let totalSeconds = max(Int(seconds.rounded()), 0)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        }

        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func notifyTransferredLogs(_ items: [PhonePendingSyncItem]) async {
        let titles = items.map(\.title).filter { !$0.isEmpty }
        let content = UNMutableNotificationContent()
        content.title = items.count == 1 ? "Log synced" : "\(items.count) logs synced"
        content.body = titles.isEmpty ? "Transferred to server." : titles.joined(separator: ", ")
        content.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "phone-sync-\(UUID().uuidString)", content: content, trigger: nil))
    }

    private func notifyBoobieReminder(after side: PhoneNursingSide) async {
        let nextSide = side == .left ? "right" : "left"
        let content = UNMutableNotificationContent()
        content.title = "Boobie reminder"
        content.body = "Drain breasts. Try \(nextSide) next time. Warm breast. Cool breast."
        content.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "phone-boobie-\(UUID().uuidString)", content: content, trigger: nil))
    }

    private func updatePendingStatus() {
        pendingSyncCount = pendingItems.count
        if isSyncing {
            syncStatus = "Syncing..."
        } else if !lastSyncError.isEmpty && pendingSyncCount > 0 {
            syncStatus = "Sync failed"
        } else if pendingSyncCount > 0 {
            syncStatus = pendingSyncCount == 1 ? "1 pending" : "\(pendingSyncCount) pending"
        } else {
            syncStatus = "Synced"
            lastSyncError = ""
        }
    }

    private func loadEntries() {
        guard let data = try? Data(contentsOf: entriesURL) else { return }
        entries = (try? decoder.decode([PhoneLogEntry].self, from: data)) ?? []
    }

    private func saveEntries() {
        guard let data = try? encoder.encode(entries) else { return }
        try? data.write(to: entriesURL, options: [.atomic])
    }

    private func loadPendingItems() {
        guard let data = try? Data(contentsOf: pendingURL) else { return }
        pendingItems = (try? decoder.decode([PhonePendingSyncItem].self, from: data)) ?? []
        backfillPendingEventTimes()
    }

    private func backfillPendingEventTimes() {
        var changed = false

        pendingItems = pendingItems.map { item in
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
            savePendingItems()
        }
    }

    private func savePendingItems() {
        guard let data = try? encoder.encode(pendingItems) else { return }
        try? data.write(to: pendingURL, options: [.atomic])
    }

    private func loadActiveSleep() {
        let timestamp = UserDefaults.standard.double(forKey: activeSleepKey)
        activeSleepStartedAt = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    private func loadActiveActivities() {
        guard let stored = UserDefaults.standard.dictionary(forKey: activeActivitiesKey) as? [String: Double] else { return }
        activeActivities = stored.reduce(into: [PhoneLogKind: Date]()) { result, item in
            guard let kind = PhoneLogKind(rawValue: item.key), item.value > 0 else { return }
            result[kind] = Date(timeIntervalSince1970: item.value)
        }
    }

    private func saveActiveActivities() {
        let stored = activeActivities.reduce(into: [String: Double]()) { result, item in
            result[item.key.rawValue] = item.value.timeIntervalSince1970
        }
        UserDefaults.standard.set(stored, forKey: activeActivitiesKey)
    }

    private var entriesURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("phone-newborn-log.json")
    }

    private var pendingURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("phone-pending-sync.json")
    }
}

actor PhoneLogSyncClient {
    static let shared = PhoneLogSyncClient()

    private let selectedBaseURLKey = "TinyNewbornLog.phoneSelectedBaseURL"
    private let candidates = [homeServerURL, tailscaleServerURL]
    private var selectedBaseURL: URL?

    init() {
        if let stored = UserDefaults.standard.string(forKey: selectedBaseURLKey), let url = URL(string: stored) {
            selectedBaseURL = url
        }
    }

    fileprivate func fetchLogs() async throws -> [PhoneRemoteLog] {
        let mode = PhoneServerMode(rawValue: UserDefaults.standard.string(forKey: PhoneServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw PhoneSyncFailure(message: "Server mode is None")
        }

        var failures: [String] = []
        for baseURL in await reachableCandidates(mode: mode) {
            do {
                let logs = try await fetchLogs(from: baseURL)
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return logs
            } catch {
                failures.append("\(serverLabel(for: baseURL)): \(shortMessage(for: error))")
                if mode != .automatic { break }
            }
        }

        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
        throw PhoneSyncFailure(message: failures.joined(separator: "; "))
    }

    fileprivate func fetchUnitSettings() async throws -> PhoneUnitSettings {
        let mode = PhoneServerMode(rawValue: UserDefaults.standard.string(forKey: PhoneServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw PhoneSyncFailure(message: "Server mode is None")
        }

        var failures: [String] = []
        for baseURL in await reachableCandidates(mode: mode) {
            do {
                let settings = try await fetchUnitSettings(from: baseURL)
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return settings
            } catch {
                failures.append("\(serverLabel(for: baseURL)): \(shortMessage(for: error))")
                if mode != .automatic { break }
            }
        }

        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
        throw PhoneSyncFailure(message: failures.joined(separator: "; "))
    }

    func postLogData(_ body: Data) async throws {
        let mode = PhoneServerMode(rawValue: UserDefaults.standard.string(forKey: PhoneServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw PhoneSyncFailure(message: "Server mode is None")
        }

        var failures: [String] = []
        for baseURL in await reachableCandidates(mode: mode) {
            do {
                try await post(body, to: baseURL)
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return
            } catch is PhoneSyncConflict {
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return
            } catch {
                failures.append("\(serverLabel(for: baseURL)): \(shortMessage(for: error))")
                if mode != .automatic { break }
            }
        }

        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
        throw PhoneSyncFailure(message: failures.joined(separator: "; "))
    }

    func updateLog(remoteID: String, body: Data) async throws {
        let mode = PhoneServerMode(rawValue: UserDefaults.standard.string(forKey: PhoneServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw PhoneSyncFailure(message: "Server mode is None")
        }

        var failures: [String] = []
        for baseURL in await reachableCandidates(mode: mode) {
            do {
                try await put(body, remoteID: remoteID, to: baseURL)
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return
            } catch {
                failures.append("\(serverLabel(for: baseURL)): \(shortMessage(for: error))")
                if mode != .automatic { break }
            }
        }

        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
        throw PhoneSyncFailure(message: failures.joined(separator: "; "))
    }

    func deleteLog(remoteID: String) async throws {
        let mode = PhoneServerMode(rawValue: UserDefaults.standard.string(forKey: PhoneServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw PhoneSyncFailure(message: "Server mode is None")
        }

        var failures: [String] = []
        for baseURL in await reachableCandidates(mode: mode) {
            do {
                try await delete(remoteID: remoteID, from: baseURL)
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return
            } catch {
                failures.append("\(serverLabel(for: baseURL)): \(shortMessage(for: error))")
                if mode != .automatic { break }
            }
        }

        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
        throw PhoneSyncFailure(message: failures.joined(separator: "; "))
    }

    private func reachableCandidates(mode: PhoneServerMode) async -> [URL] {
        var reachable: [URL] = []

        for baseURL in orderedCandidates(mode: mode) {
            if await canReachServer(at: baseURL) {
                reachable.append(baseURL)
            }
        }

        return reachable.isEmpty ? orderedCandidates(mode: mode) : reachable
    }

    private func canReachServer(at baseURL: URL) async -> Bool {
        let url = baseURL.appendingPathComponent("api/app-data")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 2

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                return false
            }
            return (200..<500).contains(http.statusCode)
        } catch {
            return false
        }
    }

    private func post(_ body: Data, to baseURL: URL) async throws {
        let url = baseURL.appendingPathComponent("api/logs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PhoneSyncFailure(message: "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8)?
                .replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let message = body.isEmpty ? "HTTP \(http.statusCode)" : "HTTP \(http.statusCode): \(body)"
            if http.statusCode == 409 {
                throw PhoneSyncConflict(message: message)
            }
            throw PhoneSyncFailure(message: message)
        }
    }

    private func put(_ body: Data, remoteID: String, to baseURL: URL) async throws {
        let url = baseURL.appendingPathComponent("api/logs").appendingPathComponent(remoteID)
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PhoneSyncFailure(message: "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8)?
                .replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw PhoneSyncFailure(message: body.isEmpty ? "HTTP \(http.statusCode)" : "HTTP \(http.statusCode): \(body)")
        }
    }

    private func delete(remoteID: String, from baseURL: URL) async throws {
        let url = baseURL.appendingPathComponent("api/logs").appendingPathComponent(remoteID)
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PhoneSyncFailure(message: "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) || http.statusCode == 404 else {
            let body = String(data: data, encoding: .utf8)?
                .replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw PhoneSyncFailure(message: body.isEmpty ? "HTTP \(http.statusCode)" : "HTTP \(http.statusCode): \(body)")
        }
    }

    private func fetchLogs(from baseURL: URL) async throws -> [PhoneRemoteLog] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/logs"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "days", value: "2")]
        let url = components?.url ?? baseURL.appendingPathComponent("api/logs")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode([PhoneRemoteLog].self, from: data)
    }

    private func fetchUnitSettings(from baseURL: URL) async throws -> PhoneUnitSettings {
        let url = baseURL.appendingPathComponent("api/unit-settings")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(PhoneUnitSettingsResponse.self, from: data).unitSettings
    }

    private func orderedCandidates(mode: PhoneServerMode) -> [URL] {
        switch mode {
        case .homeLAN:
            return [homeServerURL]
        case .tailscale:
            return [tailscaleServerURL]
        case .none:
            return []
        case .automatic:
            guard let selectedBaseURL else { return candidates }
            return [selectedBaseURL] + candidates.filter { $0 != selectedBaseURL }
        }
    }

    private func serverLabel(for url: URL) -> String {
        if url.host == homeServerURL.host {
            return "192"
        }
        if url.host == tailscaleServerURL.host {
            return "100"
        }
        return url.host ?? "server"
    }

    private func shortMessage(for error: Error) -> String {
        guard let urlError = error as? URLError else {
            return error.localizedDescription
        }

        switch urlError.code {
        case .cannotConnectToHost, .notConnectedToInternet, .networkConnectionLost:
            return "cannot connect"
        case .timedOut:
            return "timed out"
        case .badServerResponse:
            return "bad server response"
        case .appTransportSecurityRequiresSecureConnection:
            return "HTTP blocked"
        default:
            return urlError.localizedDescription
        }
    }
}

private struct PhoneSyncFailure: LocalizedError {
    let message: String

    var errorDescription: String? {
        message.isEmpty ? "Cannot connect to server" : message
    }
}

private struct PhoneRemoteLog: Decodable {
    let id: String
    let date: String
    let time: String
    let type: String
    let status: String?
    let method: String?
    let side: String?
    let routine: String?
    let pee: Bool?
    let poop: Bool?
    let poopColorId: String?
    let poopColor: String?
    let ounces: Double?
    let milkType: String?
    let weight: Double?
    let weightUnit: String?
    let height: Double?
    let heightUnit: String?
    let notes: String?
    let createdAt: String?
    let timestamp: String?

    var eventDate: Date {
        if let createdAt, let date = Self.isoFormatter.date(from: createdAt) {
            return date
        }
        if let timestamp, let date = Self.isoFormatter.date(from: timestamp) {
            return date
        }
        return Self.localFormatter.date(from: "\(date) \(time)") ?? Date()
    }

    var localEntry: PhoneLogEntry? {
        let kind: PhoneLogKind
        var endedAt: Date?
        var detail: String?
        var sideValue: PhoneNursingSide?
        var amount: Double?
        var unit: String?

        switch type {
        case "sleep":
            kind = .sleep
            detail = status == "asleep" ? "Started" : "Awake"
        case "feeding":
            guard method == "breast" else { return nil }
            kind = .nursing
            sideValue = side == "right" ? .right : .left
        case "bottle":
            kind = .bottle
            amount = (ounces ?? 0) * 29.5735
            detail = PhoneBottleMilkType.fromPayload(milkType).rawValue
            unit = "ml"
        case "diaper":
            kind = .diaper
            let colorID = poopColorId ?? poopColor
            detail = poop == true ? PhonePoopColorOption.label(for: colorID).map { "Poo: \($0)" } ?? "Poo" : "Wee"
        case "growth_stats":
            kind = .babyStats
            if let weight {
                detail = "Weight"
                amount = weight
                unit = weightUnit ?? "lb"
            } else {
                detail = "Height"
                amount = height
                unit = heightUnit ?? "in"
            }
        case "bath":
            kind = .bath
            detail = status == "end" ? "Ended" : "Started"
        case "tummy_time":
            kind = .tummyTime
            detail = status == "end" ? "Ended" : "Started"
        case "outdoor_time":
            kind = .outdoorTime
            detail = status == "end" ? "Ended" : "Started"
        case "baby_gym":
            kind = .babyGym
        case "routine":
            kind = .routines
            detail = routineLabel
        default:
            return nil
        }

        if ["sleep", "bath", "tummy_time", "outdoor_time"].contains(type), status == "end" {
            endedAt = eventDate
        }

        return PhoneLogEntry(
            id: UUID(uuidString: id) ?? UUID(),
            remoteID: id,
            kind: kind,
            startedAt: eventDate,
            endedAt: endedAt,
            side: sideValue,
            amount: amount,
            detail: detail,
            unit: unit,
            milkType: type == "bottle" ? PhoneBottleMilkType.fromPayload(milkType) : nil,
            poopColorID: poopColorId ?? poopColor,
            syncState: .synced
        )
    }

    private var routineLabel: String {
        switch routine {
        case "naptime": return "Naptime routine"
        case "bedtime": return "Bedtime routine"
        default: return "Morning routine"
        }
    }

    private static let isoFormatter = ISO8601DateFormatter()
    private static let localFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
}

private struct PhoneSyncConflict: LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

private struct PhoneUnitSettingsResponse: Decodable {
    let unitSettings: PhoneUnitSettings

    private enum CodingKeys: String, CodingKey {
        case unitSettings = "unit_settings"
    }
}

private enum PhoneNumberFormatter {
    static let shortDecimal: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }()
}

private func phoneConvertWeight(_ value: Double, from sourceUnit: String, to targetUnit: String) -> Double {
    let gramsByUnit = ["oz": 28.349523125, "lb": 453.59237, "g": 1.0, "kg": 1000.0]
    let grams = value * (gramsByUnit[sourceUnit] ?? gramsByUnit["lb"]!)
    let converted = grams / (gramsByUnit[targetUnit] ?? gramsByUnit["lb"]!)
    return phoneRoundedMeasurement(converted, unit: targetUnit)
}

private func phoneConvertHeight(_ value: Double, from sourceUnit: String, to targetUnit: String) -> Double {
    let mmByUnit = ["in": 25.4, "ft": 304.8, "cm": 10.0, "mm": 1.0]
    let mm = value * (mmByUnit[sourceUnit] ?? mmByUnit["in"]!)
    let converted = mm / (mmByUnit[targetUnit] ?? mmByUnit["in"]!)
    return phoneRoundedMeasurement(converted, unit: targetUnit)
}

private func phoneRoundedMeasurement(_ value: Double, unit: String) -> Double {
    if unit == "g" || unit == "mm" {
        return value.rounded()
    }
    return (value * 10).rounded() / 10
}
