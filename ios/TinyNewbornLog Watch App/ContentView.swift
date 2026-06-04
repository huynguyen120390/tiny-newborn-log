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

struct ContentView: View {
    @StateObject private var store = LogStore()
    @StateObject private var reminderPlayer = ReminderPlayer()
    @State private var bottleML = 60.0
    @State private var measurementKind: MeasurementKind = .weight
    @State private var measurementValue = 8.0
    @AppStorage("bathSoundEnabled") private var bathSoundEnabled = false
    @AppStorage("bathReminderSeconds") private var bathReminderSeconds = 300
    @AppStorage("tummySoundEnabled") private var tummySoundEnabled = false
    @AppStorage("tummyReminderSeconds") private var tummyReminderSeconds = 300
    @State private var activeSheet: LoggerSheet?

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

                    statusStrip
                    recentStrip
                }
                .padding(.horizontal, 6)
                .padding(.top, 4)
                .padding(.bottom, 10)
            }
            .task {
                await store.retryPendingSyncs()
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
            }

            Text("Tap a card, log the moment.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 4)
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
            Label(store.syncStatus, systemImage: syncSymbol)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
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

    private var recentStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Recent")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if store.recentEntries.isEmpty {
                Text("No logs yet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(store.recentEntries.prefix(5)) { entry in
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

                        Text("\(entry.startedAt, style: .time)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
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
            DiaperSheet { event in
                store.logDiaper(event)
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
        }
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
    var onLog: (DiaperEvent) -> Void

    var body: some View {
        NavigationStack {
            List {
                Button {
                    onLog(.wee)
                } label: {
                    Label("Wee", systemImage: "drop.fill")
                }
                .tint(.yellow)

                Button {
                    onLog(.poo)
                } label: {
                    Label("Poo", systemImage: "circle.fill")
                }
                .tint(.brown)
            }
            .navigationTitle("Wee & Poo")
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

#Preview {
    ContentView()
}
