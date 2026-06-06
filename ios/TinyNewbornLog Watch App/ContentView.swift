import SwiftUI
import AVFoundation
import WatchKit

private func formatElapsed(_ elapsed: TimeInterval) -> String {
    let totalSeconds = max(Int(elapsed.rounded()), 0)

    if totalSeconds < 60 {
        return totalSeconds == 1 ? "1 second" : "\(totalSeconds) seconds"
    }

    let minutes = totalSeconds / 60
    let seconds = totalSeconds % 60
    return "\(minutes):\(String(format: "%02d", seconds))"
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

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var store = LogStore()
    @StateObject private var reminderPlayer = ReminderPlayer()
    @State private var bottleML = 60.0
    @State private var measurementKind: MeasurementKind = .weight
    @State private var measurementValue = 8.0
    @AppStorage("bathSoundEnabled") private var bathSoundEnabled = false
    @AppStorage("bathReminderSeconds") private var bathReminderSeconds = 300
    @AppStorage("tummySoundEnabled") private var tummySoundEnabled = false
    @AppStorage("tummyReminderSeconds") private var tummyReminderSeconds = 300
    @AppStorage(SyncServerMode.storageKey) private var syncServerMode: SyncServerMode = .automatic
    @State private var activeSheet: LoggerSheet?
    @State private var selectedLogFilter: LogKind?
    private let syncRetryTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    header
                    LazyVGrid(columns: columns, spacing: 8) {
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

                    todayLogStrip
                }
                .padding(.horizontal, 6)
                .padding(.top, 4)
                .padding(.bottom, 10)
            }
            .task {
                await store.retryPendingSyncs()
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active else {
                    return
                }

                requestSyncRetry()
            }
            .onReceive(syncRetryTimer) { _ in
                requestSyncRetry()
            }
            .sheet(item: $activeSheet) { sheet in
                sheetContent(sheet)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image("AppLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 22, height: 22)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                Text("TinyNewbornLog")
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Spacer(minLength: 2)

                Button {
                    activeSheet = .settings
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                Button {
                    requestSyncRetry()
                } label: {
                    Image(systemName: headerSyncSymbol)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(headerSyncColor)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 4) {
                Text(store.lastLogMessage)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                if store.pendingSyncCount > 0 {
                    Text("• \(store.syncStatus)")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 4)
    }

    private var headerSyncSymbol: String {
        store.pendingSyncCount > 0 ? "cloud.slash.fill" : "checkmark.circle.fill"
    }

    private var headerSyncColor: Color {
        store.pendingSyncCount > 0 ? .blue : .green
    }

    private var sleepCard: some View {
        LoggerCard(
            title: store.activeSleepStartedAt == nil ? "Sleep" : "Awake",
            value: "",
            subtitle: sleepSubtitle,
            symbolName: LogKind.sleep.symbolName,
            color: store.activeSleepStartedAt == nil ? .indigo : .orange
        ) {
            activeSheet = .sleep
        }
    }

    private var boobieCard: some View {
        LoggerCard(
            title: "Boobie",
            value: "",
            subtitle: "Left or Right",
            symbolName: LogKind.nursing.symbolName,
            color: .pink
        ) {
            activeSheet = .boobie
        }
    }

    private var bottleCard: some View {
        LoggerCard(
            title: "Bottle",
            value: "\(Int(bottleML))",
            subtitle: "ml",
            symbolName: LogKind.bottle.symbolName,
            color: .teal
        ) {
            activeSheet = .bottle
        }
    }

    private var diaperCard: some View {
        LoggerCard(
            title: "Wee & Poo",
            value: "\(store.todaysCount(for: .diaper))",
            subtitle: "today",
            symbolName: LogKind.diaper.symbolName,
            color: .brown
        ) {
            activeSheet = .diaper
        }
    }

    private var statsCard: some View {
        LoggerCard(
            title: "Baby Stats",
            value: measurementKind.rawValue,
            subtitle: "\(measurementValueText) \(measurementKind.unit)",
            symbolName: LogKind.babyStats.symbolName,
            color: .blue
        ) {
            activeSheet = .babyStats
        }
    }

    private func timedCard(_ kind: LogKind, color: Color) -> some View {
        let isActive = store.activeActivities[kind] != nil

        return LoggerCard(
            title: kind.title,
            value: "",
            subtitle: isActive ? activeElapsedText(for: kind) : "\(store.todaysCount(for: kind)) today",
            symbolName: kind.symbolName,
            color: color
        ) {
            activeSheet = .timed(kind)
        }
    }

    private var routinesCard: some View {
        LoggerCard(
            title: "Routines",
            value: "",
            subtitle: "\(store.todaysCount(for: .routines)) today",
            symbolName: LogKind.routines.symbolName,
            color: .purple
        ) {
            activeSheet = .routines
        }
    }

    private func quickCard(_ kind: LogKind, color: Color) -> some View {
        LoggerCard(
            title: kind.title,
            value: "Log",
            subtitle: "\(store.todaysCount(for: kind)) today",
            symbolName: kind.symbolName,
            color: color
        ) {
            activeSheet = .quick(kind)
        }
    }

    private var sleepSubtitle: String {
        guard let startedAt = store.activeSleepStartedAt else {
            return "baby awake"
        }

        return "since \(startedAt.formatted(date: .omitted, time: .shortened))"
    }

    private func activeSubtitle(for kind: LogKind) -> String {
        guard let startedAt = store.activeActivities[kind] else {
            return "ready"
        }

        return "since \(startedAt.formatted(date: .omitted, time: .shortened))"
    }

    private func activeElapsedText(for kind: LogKind) -> String {
        guard let startedAt = store.activeActivities[kind] else {
            return "ready"
        }

        return formatElapsed(Date().timeIntervalSince(startedAt))
    }

    private var measurementValueText: String {
        String(format: "%.1f", measurementValue)
    }

    private var statusStrip: some View {
        HStack(spacing: 8) {
            Button {
                requestSyncRetry()
            } label: {
                Label(store.syncStatus, systemImage: syncSymbol)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)

            Spacer()
            Text("\(Int(store.todaysBottleML)) ml")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
    }

    private var syncSymbol: String {
        switch store.syncStatus {
        case "Synced":
            return "checkmark.circle.fill"
        case "Sync failed":
            return "exclamationmark.triangle.fill"
        case "Syncing...":
            return "arrow.triangle.2.circlepath"
        default:
            return store.pendingSyncCount > 0 ? "clock.badge.exclamationmark" : "wifi"
        }
    }

    private func requestSyncRetry() {
        Task {
            await store.retryPendingSyncs()
        }
    }

    private func cycleLogFilter() {
        guard let selectedLogFilter else {
            self.selectedLogFilter = LogKind.allCases.first
            return
        }

        guard let index = LogKind.allCases.firstIndex(of: selectedLogFilter) else {
            self.selectedLogFilter = nil
            return
        }

        let nextIndex = LogKind.allCases.index(after: index)
        self.selectedLogFilter = nextIndex == LogKind.allCases.endIndex ? nil : LogKind.allCases[nextIndex]
    }

    private var filteredTodayEntries: [NewbornLogEntry] {
        store.entriesForDay(offset: 0, matching: selectedLogFilter)
    }

    private var filteredYesterdayEntries: [NewbornLogEntry] {
        store.entriesForDay(offset: -1, matching: selectedLogFilter)
            .filter { yesterdayEntry in
                !filteredTodayEntries.contains { $0.id == yesterdayEntry.id }
            }
    }

    private var todayLogStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Today Log")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    cycleLogFilter()
                } label: {
                    Label(selectedLogFilter?.title ?? "All", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption)
                }
                .buttonStyle(.plain)
            }

            if filteredTodayEntries.isEmpty && filteredYesterdayEntries.isEmpty {
                Text("No logs yet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                logSection(title: "Today", entries: filteredTodayEntries)

                if !filteredYesterdayEntries.isEmpty {
                    Divider()
                    logSection(title: "Yesterday", entries: filteredYesterdayEntries)
                }
            }
        }
        .padding(8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private func logSection(title: String, entries: [NewbornLogEntry]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)

            ForEach(entries) { entry in
                logRow(entry)
            }
        }
    }

    private func logRow(_ entry: NewbornLogEntry) -> some View {
        Button {
            activeSheet = .edit(entry)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: entry.kind.symbolName)
                    .font(.caption)
                    .foregroundStyle(color(for: entry.kind))
                    .frame(width: 16)

                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.kind.title)
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                    Text(store.detailText(for: entry))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                if store.isPending(entry) {
                    PendingHourglassIcon()
                }

                VStack(alignment: .trailing, spacing: 0) {
                    Text(entry.startedAt, style: .time)
                    Text(entry.startedAt, format: .dateTime.month(.abbreviated).day())
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func sheetContent(_ sheet: LoggerSheet) -> some View {
        switch sheet {
        case .sleep:
            SleepSheet(
                isAsleep: store.activeSleepStartedAt != nil,
                detail: sleepSubtitle
            ) {
                store.toggleSleep()
                activeSheet = nil
            }
        case .boobie:
            BoobieSheet { side in
                store.logNursing(side: side)
                activeSheet = nil
            }
        case .bottle:
            BottleSheet(bottleML: $bottleML) {
                store.logBottle(amountML: bottleML)
                activeSheet = nil
            }
        case .diaper:
            DiaperSheet { event, poopColor in
                store.logDiaper(event, poopColor: poopColor)
                activeSheet = nil
            }
        case .babyStats:
            BabyStatsSheet(kind: $measurementKind, value: $measurementValue) {
                store.logMeasurement(kind: measurementKind, value: measurementValue)
                activeSheet = nil
            }
        case .timed(let kind):
            TimedActivitySheet(
                kind: kind,
                isActive: store.activeActivities[kind] != nil,
                startedAt: store.activeActivities[kind],
                detail: activeSubtitle(for: kind),
                soundEnabled: soundBinding(for: kind),
                reminderSeconds: reminderBinding(for: kind)
            ) {
                let wasActive = store.activeActivities[kind] != nil
                let shouldStart = !wasActive
                store.toggleTimedActivity(kind)
                updateReminder(for: kind, shouldStart: shouldStart)

                if wasActive {
                    activeSheet = nil
                }
            }
        case .quick(let kind):
            QuickActivitySheet(kind: kind) {
                store.logQuickActivity(kind)
                activeSheet = nil
            }
        case .routines:
            RoutinesSheet { routine in
                store.logRoutine(routine)
                activeSheet = nil
            }
        case .settings:
            SyncSettingsSheet(mode: $syncServerMode) {
                Task {
                    await WebLogSyncClient.shared.resetSelectedBaseURL()
                    if syncServerMode != .none {
                        await store.retryPendingSyncs()
                    }
                }
            }
        case .edit(let entry):
            EditLogSheet(entry: entry, detailText: store.detailText(for: entry)) { updated in
                Task { await store.relog(updated) }
                activeSheet = nil
            } onDelete: { entry in
                Task { await store.remove(entry) }
                activeSheet = nil
            }
        }
    }

    private func soundBinding(for kind: LogKind) -> Binding<Bool> {
        switch kind {
        case .bath:
            return $bathSoundEnabled
        case .tummyTime:
            return $tummySoundEnabled
        default:
            return .constant(false)
        }
    }

    private func reminderBinding(for kind: LogKind) -> Binding<Int> {
        switch kind {
        case .bath:
            return $bathReminderSeconds
        case .tummyTime:
            return $tummyReminderSeconds
        default:
            return .constant(300)
        }
    }

    private func updateReminder(for kind: LogKind, shouldStart: Bool) {
        guard kind == .bath || kind == .tummyTime else {
            return
        }

        let soundEnabled = kind == .bath ? bathSoundEnabled : tummySoundEnabled
        let seconds = kind == .bath ? bathReminderSeconds : tummyReminderSeconds

        if shouldStart && soundEnabled {
            reminderPlayer.start(kind: kind, everySeconds: seconds)
        } else {
            reminderPlayer.stop(kind: kind)
        }
    }

    private func color(for kind: LogKind) -> Color {
        switch kind {
        case .sleep:
            return .indigo
        case .nursing:
            return .pink
        case .bottle:
            return .teal
        case .diaper:
            return .brown
        case .babyStats:
            return .blue
        case .bath:
            return .cyan
        case .tummyTime:
            return .green
        case .outdoorTime:
            return .yellow
        case .babyGym:
            return .mint
        case .routines:
            return .purple
        }
    }
}

private enum LoggerSheet: Identifiable {
    case sleep
    case boobie
    case bottle
    case diaper
    case babyStats
    case timed(LogKind)
    case quick(LogKind)
    case routines
    case settings
    case edit(NewbornLogEntry)

    var id: String {
        switch self {
        case .sleep:
            return "sleep"
        case .boobie:
            return "boobie"
        case .bottle:
            return "bottle"
        case .diaper:
            return "diaper"
        case .babyStats:
            return "babyStats"
        case .timed(let kind):
            return "timed-\(kind.rawValue)"
        case .quick(let kind):
            return "quick-\(kind.rawValue)"
        case .routines:
            return "routines"
        case .settings:
            return "settings"
        case .edit(let entry):
            return "edit-\(entry.id.uuidString)"
        }
    }
}

private struct SyncSettingsSheet: View {
    @Binding var mode: SyncServerMode
    var onModeChanged: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(SyncServerMode.allCases) { option in
                        Button {
                            mode = option
                            onModeChanged()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: option == mode ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(option == mode ? .green : .secondary)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(option.title)
                                        .font(.body.weight(.semibold))
                                    Text(option.detail)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Sync server")
                }

                Text("Use None to mimic lost connection. Logs stay local and become pending until you switch back.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Settings")
        }
    }
}

private struct PendingHourglassIcon: View {
    @State private var isFlipped = false

    var body: some View {
        ZStack {
            Image(systemName: "arrow.clockwise.circle")
                .font(.caption.weight(.bold))

            Image(systemName: "hourglass")
                .font(.system(size: 8, weight: .bold))
                .rotationEffect(.degrees(isFlipped ? 180 : 0))
                .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: false), value: isFlipped)
        }
        .foregroundStyle(.orange)
        .onAppear {
            isFlipped = true
        }
        .accessibilityLabel("Pending sync")
    }
}

private struct LoggerCard: View {
    var title: String
    var value: String
    var subtitle: String
    var symbolName: String
    var color: Color
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 7) {
                Image(systemName: symbolName)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.black)
                    .frame(width: 29, height: 29)
                    .background(color, in: Circle())

                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    if !value.isEmpty {
                        Text(value)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }

                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 98, maxHeight: 98, alignment: .leading)
            .padding(8)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(color.opacity(0.42), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct SleepSheet: View {
    var isAsleep: Bool
    var detail: String
    var onLog: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Label(detail, systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button(action: onLog) {
                    Label(isAsleep ? "Log Awake" : "Log Sleep", systemImage: isAsleep ? "sun.max.fill" : "moon.zzz.fill")
                }
                .tint(isAsleep ? .orange : .indigo)
            }
            .navigationTitle(isAsleep ? "Awake" : "Sleep")
        }
    }
}

private struct BoobieSheet: View {
    var onLog: (NursingSide) -> Void

    var body: some View {
        NavigationStack {
            List {
                Button {
                    onLog(.left)
                } label: {
                    Label("Left", systemImage: "arrow.left.circle.fill")
                }
                .tint(.pink)

                Button {
                    onLog(.right)
                } label: {
                    Label("Right", systemImage: "arrow.right.circle.fill")
                }
                .tint(.pink)
            }
            .navigationTitle("Boobie")
        }
    }
}

private struct BottleSheet: View {
    @Binding var bottleML: Double
    var onLog: () -> Void

    var body: some View {
        NavigationStack {
            List {
                CompactStepper(
                    title: "Amount",
                    value: "\(Int(bottleML))",
                    unit: "ml",
                    onMinus: { bottleML = max(bottleML - 10, 10) },
                    onPlus: { bottleML = min(bottleML + 10, 240) }
                )

                Button(action: onLog) {
                    Label("Log Bottle", systemImage: "drop.fill")
                }
                .tint(.teal)
            }
            .navigationTitle("Bottle")
        }
    }
}

private struct DiaperSheet: View {
    var onLog: (DiaperEvent, PoopColorOption?) -> Void

    var body: some View {
        NavigationStack {
            List {
                Button {
                    onLog(.wee, nil)
                } label: {
                    Label("Wee", systemImage: "drop.fill")
                }
                .tint(.yellow)

                Section("Poo color") {
                    ForEach(PoopColorOption.all) { option in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color(hex: option.hex))
                                .frame(width: 20, height: 20)
                                .overlay(Circle().strokeBorder(.secondary.opacity(0.35), lineWidth: 1))

                            VStack(alignment: .leading, spacing: 1) {
                                Text(option.label)
                                    .font(.caption.weight(.semibold))
                                Text(option.status)
                                    .font(.caption2)
                                    .foregroundStyle(statusColor(option.status))
                            }

                            Spacer(minLength: 4)

                            Button("Log") {
                                onLog(.poo, option)
                            }
                            .font(.caption2.weight(.semibold))
                            .buttonStyle(.borderedProminent)
                            .controlSize(.mini)
                        }
                        .padding(.vertical, 2)
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

private struct EditLogSheet: View {
    @State private var entry: NewbornLogEntry
    @State private var eventDate: Date
    @State private var amount: Double
    @State private var side: NursingSide
    @State private var poopColorID: String
    @State private var measurementKind: MeasurementKind
    let detailText: String
    let onRelog: (NewbornLogEntry) -> Void
    let onDelete: (NewbornLogEntry) -> Void

    init(entry: NewbornLogEntry, detailText: String, onRelog: @escaping (NewbornLogEntry) -> Void, onDelete: @escaping (NewbornLogEntry) -> Void) {
        self._entry = State(initialValue: entry)
        self._eventDate = State(initialValue: entry.endedAt ?? entry.startedAt)
        self._amount = State(initialValue: entry.amountML ?? 0)
        self._side = State(initialValue: entry.side ?? .left)
        self._poopColorID = State(initialValue: entry.poopColorID ?? PoopColorOption.all.first?.id ?? "")
        self._measurementKind = State(initialValue: entry.detail == "Height" ? .height : .weight)
        self.detailText = detailText
        self.onRelog = onRelog
        self.onDelete = onDelete
    }

    var body: some View {
        NavigationStack {
            List {
                Text(detailText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                DatePicker("Time", selection: $eventDate, displayedComponents: [.date, .hourAndMinute])

                switch entry.kind {
                case .nursing:
                    Picker("Side", selection: $side) {
                        ForEach(NursingSide.allCases) { side in
                            Text(side.rawValue).tag(side)
                        }
                    }
                case .bottle:
                    CompactStepper(title: "Milk", value: "\(Int(amount))", unit: "ml", onMinus: { amount = max(5, amount - 5) }, onPlus: { amount = min(300, amount + 5) })
                case .diaper:
                    Picker("Kind", selection: $entry.detail) {
                        Text("Wee").tag(Optional("Wee"))
                        Text("Poo").tag(Optional("Poo"))
                    }
                    if entry.detail != "Wee" {
                        Picker("Color", selection: $poopColorID) {
                            ForEach(PoopColorOption.all) { option in
                                Text(option.label).tag(option.id)
                            }
                        }
                    }
                case .babyStats:
                    Picker("Type", selection: $measurementKind) {
                        ForEach(MeasurementKind.allCases) { kind in
                            Text(kind.rawValue).tag(kind)
                        }
                    }
                    CompactStepper(title: measurementKind.rawValue, value: String(format: "%.1f", amount), unit: measurementKind.unit, onMinus: { amount = max(0.1, amount - 0.1) }, onPlus: { amount += 0.1 })
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
                    updated.amountML = amount > 0 ? amount : updated.amountML
                    updated.side = updated.kind == .nursing ? side : updated.side
                    if updated.kind == .diaper {
                        let isWee = updated.detail == "Wee"
                        updated.poopColorID = isWee ? nil : poopColorID
                        updated.detail = isWee ? "Wee" : PoopColorOption.label(for: poopColorID).map { "Poo: \($0)" } ?? "Poo"
                    }
                    if updated.kind == .babyStats {
                        updated.detail = measurementKind.rawValue
                        updated.amountUnit = measurementKind.unit
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
            .navigationTitle("Edit")
        }
    }
}

private struct BabyStatsSheet: View {
    @Binding var kind: MeasurementKind
    @Binding var value: Double
    var onLog: () -> Void

    private var bounds: ClosedRange<Double> {
        kind == .weight ? 4...30 : 16...40
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("Type", selection: $kind) {
                    ForEach(MeasurementKind.allCases) { measurement in
                        Text(measurement.rawValue).tag(measurement)
                    }
                }

                CompactStepper(
                    title: kind.rawValue,
                    value: String(format: "%.1f", value),
                    unit: kind.unit,
                    onMinus: { value = max((value - 0.1) * 10, bounds.lowerBound * 10).rounded() / 10 },
                    onPlus: { value = min((value + 0.1) * 10, bounds.upperBound * 10).rounded() / 10 }
                )

                Button(action: onLog) {
                    Label("Log Stat", systemImage: "ruler")
                }
                .tint(.blue)
            }
            .navigationTitle("Baby Stats")
            .onChange(of: kind) { _, newKind in
                value = newKind == .weight ? 8.0 : 20.0
            }
        }
    }
}

private struct TimedActivitySheet: View {
    var kind: LogKind
    var isActive: Bool
    var startedAt: Date?
    var detail: String
    @Binding var soundEnabled: Bool
    @Binding var reminderSeconds: Int
    var onLog: () -> Void

    private var supportsSound: Bool {
        kind == .bath || kind == .tummyTime
    }

    var body: some View {
        NavigationStack {
            List {
                Label(isActive ? detail : "Ready to start", systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if isActive, let startedAt {
                    ElapsedTimerRow(startedAt: startedAt)
                }

                if supportsSound {
                    Toggle("Sound reminder", isOn: $soundEnabled)

                    SecondsEditor(seconds: $reminderSeconds)

                    Text("Uses watch sound/haptic and a spoken reminder while this app is running.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Button(action: onLog) {
                    Label(actionTitle, systemImage: isActive ? "stop.fill" : "play.fill")
                }
                .tint(isActive ? .orange : .green)
            }
            .navigationTitle(kind.title)
        }
    }

    private var actionTitle: String {
        if isActive && kind == .bath {
            return "Stop Bath"
        }

        if isActive {
            return "End \(kind.title)"
        }

        return "Start \(kind.title)"
    }
}

private struct ElapsedTimerRow: View {
    var startedAt: Date

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            HStack {
                Label("Timer", systemImage: "timer")
                Spacer()
                Text(formatElapsed(timeline.date.timeIntervalSince(startedAt)))
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
        }
    }
}

private struct RoutinesSheet: View {
    var onLog: (RoutineKind) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(RoutineKind.allCases) { routine in
                    Button {
                        onLog(routine)
                    } label: {
                        Label(routine.rawValue, systemImage: symbol(for: routine))
                    }
                    .tint(.purple)
                }
            }
            .navigationTitle("Routines")
        }
    }

    private func symbol(for routine: RoutineKind) -> String {
        switch routine {
        case .morning:
            return "sunrise.fill"
        case .naptime:
            return "cloud.fill"
        case .bedtime:
            return "moon.stars.fill"
        }
    }
}

private struct SecondsEditor: View {
    @Binding var seconds: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Remind every")
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack(spacing: 7) {
                Button {
                    seconds = max(seconds - stepSize, 5)
                } label: {
                    Image(systemName: "minus")
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)

                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    TextField("Seconds", text: secondsText)
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.center)
                        .frame(minWidth: 50)

                    Text("sec")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Button {
                    seconds = min(seconds + stepSize, 3600)
                } label: {
                    Image(systemName: "plus")
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 4)
        .onChange(of: seconds) { _, newValue in
            seconds = min(max(newValue, 5), 3600)
        }
    }

    private var secondsText: Binding<String> {
        Binding(
            get: { "\(seconds)" },
            set: { newValue in
                let digits = newValue.filter(\.isNumber)
                guard let value = Int(digits) else {
                    return
                }

                seconds = min(max(value, 5), 3600)
            }
        )
    }

    private var stepSize: Int {
        seconds < 60 ? 5 : 30
    }
}

private struct QuickActivitySheet: View {
    var kind: LogKind
    var onLog: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Label("Ready to log", systemImage: kind.symbolName)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button(action: onLog) {
                    Label("Log \(kind.title)", systemImage: "checkmark.circle.fill")
                }
                .tint(.mint)
            }
            .navigationTitle(kind.title)
        }
    }
}

private struct CompactStepper: View {
    var title: String
    var value: String
    var unit: String
    var onMinus: () -> Void
    var onPlus: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack(spacing: 7) {
                Button(action: onMinus) {
                    Image(systemName: "minus")
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)

                Spacer(minLength: 0)

                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(value)
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)

                    Text(unit)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(minWidth: 54)

                Spacer(minLength: 0)

                Button(action: onPlus) {
                    Image(systemName: "plus")
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
private final class ReminderPlayer: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private var timers: [LogKind: Timer] = [:]
    private var startedAt: [LogKind: Date] = [:]

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func start(kind: LogKind, everySeconds seconds: Int) {
        stop(kind: kind)
        startedAt[kind] = Date()
        announce(kind)

        timers[kind] = Timer.scheduledTimer(withTimeInterval: TimeInterval(max(seconds, 5)), repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.announce(kind)
            }
        }
    }

    func stop(kind: LogKind) {
        timers[kind]?.invalidate()
        timers[kind] = nil
        startedAt[kind] = nil
    }

    private func announce(_ kind: LogKind) {
        WKInterfaceDevice.current().play(.notification)

        let utterance = AVSpeechUtterance(string: message(for: kind, elapsed: elapsedTime(for: kind)))
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
        utterance.voice = AVSpeechSynthesisVoice(identifier: "com.apple.voice.compact.en-US.Samantha")
            ?? AVSpeechSynthesisVoice(language: "en-US")

        synthesizer.speak(utterance)
    }

    private func elapsedTime(for kind: LogKind) -> TimeInterval {
        guard let startedAt = startedAt[kind] else {
            return 0
        }

        return max(Date().timeIntervalSince(startedAt), 0)
    }

    private func message(for kind: LogKind, elapsed: TimeInterval) -> String {
        let elapsedText = formatElapsed(elapsed)

        switch kind {
        case .bath:
            return "Bath time reminder. \(elapsedText)."
        case .tummyTime:
            return "Tummy time reminder. \(elapsedText)."
        default:
            return "\(kind.title) reminder. \(elapsedText)."
        }
    }

}
