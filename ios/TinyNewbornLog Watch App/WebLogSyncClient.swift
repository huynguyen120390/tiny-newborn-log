import Foundation

enum SyncServerMode: String, CaseIterable, Identifiable {
    case automatic
    case homeLAN
    case tailscale
    case none

    static let storageKey = "TinyNewbornLog.syncServerMode"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic:
            return "Auto"
        case .homeLAN:
            return "192"
        case .tailscale:
            return "100"
        case .none:
            return "None"
        }
    }

    var detail: String {
        switch self {
        case .automatic:
            return "Try both"
        case .homeLAN:
            return "Home Wi-Fi"
        case .tailscale:
            return "Tailscale"
        case .none:
            return "Offline test"
        }
    }
}

actor WebLogSyncClient {
    static let shared = WebLogSyncClient()

    private let candidateBaseURLs = [
        URL(string: "http://192.168.86.55:3002")!,
        URL(string: "http://100.100.187.79:3002")!
    ]
    private let selectedBaseURLKey = "TinyNewbornLog.selectedWebBaseURL"
    private var selectedBaseURL: URL?

    init() {
        if let storedURLString = UserDefaults.standard.string(forKey: selectedBaseURLKey),
           let storedURL = URL(string: storedURLString) {
            selectedBaseURL = storedURL
        }
    }

    func resetSelectedBaseURL() {
        selectedBaseURL = nil
        UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)
    }

    func logSleep(status: String) async throws {
        try await postLogPayload([
            "type": "sleep",
            "status": status,
            "notes": status == "asleep" ? "Baby fell asleep" : "Baby woke up"
        ])
    }

    func logNursing(side: NursingSide) async throws {
        let webSide = side == .right ? "right" : "left"
        try await postLogPayload([
            "type": "feeding",
            "method": "breast",
            "side": webSide,
            "notes": "Started on \(webSide) side"
        ])
    }

    func logBottle(amountML: Double) async throws {
        let ounces = (amountML / 29.5735 * 100).rounded() / 100
        try await postLogPayload([
            "type": "bottle",
            "ounces": ounces,
            "milkType": BottleMilkType.formula.payloadValue,
            "notes": "\(BottleMilkType.formula.rawValue) bottle feed"
        ])
    }

    func logDiaper(_ event: DiaperEvent) async throws {
        try await postLogPayload([
            "type": "diaper",
            "kind": event == .wee ? "pee" : "poop",
            "poop": event == .poo,
            "notes": event == .wee ? "Wee diaper" : "Poo diaper"
        ])
    }

    func logMeasurement(kind: MeasurementKind, value: Double) async throws {
        if kind == .weight {
            try await postLogPayload([
                "type": "growth_stats",
                "stat": "weight",
                "weight": value,
                "weightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ])
        } else {
            try await postLogPayload([
                "type": "growth_stats",
                "stat": "height",
                "height": value,
                "heightUnit": kind.unit,
                "notes": "\(kind.rawValue): \(value) \(kind.unit)"
            ])
        }
    }

    func logRoutine(_ routine: RoutineKind) async throws {
        try await postLogPayload([
            "type": "routine",
            "routine": routine.payloadValue,
            "notes": "\(routine.rawValue) done"
        ])
    }

    func logActivity(kind: LogKind, status: String? = nil) async throws {
        var payload: [String: Any] = [
            "type": webType(for: kind),
            "notes": note(for: kind, status: status)
        ]

        if let status {
            payload["status"] = status
        }

        try await postLogPayload(payload)
    }

    func postLogPayload(_ payload: [String: Any]) async throws {
        let body = try JSONSerialization.data(withJSONObject: payload)
        try await postLogData(body)
    }

    func postLogData(_ body: Data) async throws {
        do {
            let baseURL = try await reachableBaseURL()
            try await postLogData(body, to: baseURL)
        } catch {
            selectedBaseURL = nil
            UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)

            let baseURL = try await reachableBaseURL()
            try await postLogData(body, to: baseURL)
        }
    }

    func fetchLogs() async throws -> [RemoteBabyLog] {
        do {
            let baseURL = try await reachableBaseURL()
            return try await fetchLogs(from: baseURL)
        } catch {
            selectedBaseURL = nil
            UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)

            let baseURL = try await reachableBaseURL()
            return try await fetchLogs(from: baseURL)
        }
    }

    func fetchUnitSettings() async throws -> UnitSettings {
        do {
            let baseURL = try await reachableBaseURL()
            return try await fetchUnitSettings(from: baseURL)
        } catch {
            selectedBaseURL = nil
            UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)

            let baseURL = try await reachableBaseURL()
            return try await fetchUnitSettings(from: baseURL)
        }
    }

    func updateLog(remoteID: String, body: Data) async throws {
        do {
            let baseURL = try await reachableBaseURL()
            try await putLogData(body, remoteID: remoteID, to: baseURL)
        } catch {
            selectedBaseURL = nil
            UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)

            let baseURL = try await reachableBaseURL()
            try await putLogData(body, remoteID: remoteID, to: baseURL)
        }
    }

    func deleteLog(remoteID: String) async throws {
        do {
            let baseURL = try await reachableBaseURL()
            try await deleteLog(remoteID: remoteID, from: baseURL)
        } catch {
            selectedBaseURL = nil
            UserDefaults.standard.removeObject(forKey: selectedBaseURLKey)

            let baseURL = try await reachableBaseURL()
            try await deleteLog(remoteID: remoteID, from: baseURL)
        }
    }

    private func postLogData(_ body: Data, to baseURL: URL) async throws {
        let url = baseURL.appending(path: "api/logs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(httpResponse.statusCode) || httpResponse.statusCode == 409 else {
            throw URLError(.badServerResponse)
        }
    }

    private func putLogData(_ body: Data, remoteID: String, to baseURL: URL) async throws {
        let url = baseURL.appending(path: "api/logs").appending(path: remoteID)
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    private func deleteLog(remoteID: String, from baseURL: URL) async throws {
        let url = baseURL.appending(path: "api/logs").appending(path: remoteID)
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.timeoutInterval = 8

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) || httpResponse.statusCode == 404 else {
            throw URLError(.badServerResponse)
        }
    }

    private func fetchLogs(from baseURL: URL) async throws -> [RemoteBabyLog] {
        var components = URLComponents(url: baseURL.appending(path: "api/logs"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "days", value: "2")]
        let url = components?.url ?? baseURL.appending(path: "api/logs")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode([RemoteBabyLog].self, from: data)
    }

    private func fetchUnitSettings(from baseURL: URL) async throws -> UnitSettings {
        let url = baseURL.appending(path: "api/unit-settings")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(UnitSettingsResponse.self, from: data).unitSettings
    }

    private func reachableBaseURL() async throws -> URL {
        let mode = SyncServerMode(rawValue: UserDefaults.standard.string(forKey: SyncServerMode.storageKey) ?? "") ?? .automatic
        guard mode != .none else {
            throw URLError(.notConnectedToInternet)
        }

        let urlsToTry = orderedCandidateBaseURLs()

        for baseURL in urlsToTry {
            if await canReachServer(at: baseURL) {
                selectedBaseURL = baseURL
                UserDefaults.standard.set(baseURL.absoluteString, forKey: selectedBaseURLKey)
                return baseURL
            }
        }

        throw URLError(.cannotConnectToHost)
    }

    private func orderedCandidateBaseURLs() -> [URL] {
        let mode = SyncServerMode(rawValue: UserDefaults.standard.string(forKey: SyncServerMode.storageKey) ?? "") ?? .automatic

        switch mode {
        case .homeLAN:
            return [candidateBaseURLs[0]]
        case .tailscale:
            return [candidateBaseURLs[1]]
        case .none:
            return []
        case .automatic:
            break
        }

        guard let selectedBaseURL else {
            return candidateBaseURLs
        }

        return [selectedBaseURL] + candidateBaseURLs.filter { $0 != selectedBaseURL }
    }

    private func canReachServer(at baseURL: URL) async -> Bool {
        let url = baseURL.appending(path: "api/app-data")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 3

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                return false
            }
            return (200..<500).contains(httpResponse.statusCode)
        } catch {
            return false
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

}

struct RemoteBabyLog: Decodable {
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

    var localEntry: NewbornLogEntry? {
        let kind: LogKind
        var endedAt: Date?
        var detail: String?
        var sideValue: NursingSide?
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
            detail = BottleMilkType.fromPayload(milkType).rawValue
            unit = "ml"
        case "diaper":
            kind = .diaper
            let colorID = poopColorId ?? poopColor
            detail = poop == true ? PoopColorOption.label(for: colorID).map { "Poo: \($0)" } ?? "Poo" : "Wee"
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

        return NewbornLogEntry(
            id: UUID(uuidString: id) ?? UUID(),
            remoteID: id,
            kind: kind,
            startedAt: eventDate,
            endedAt: endedAt,
            side: sideValue,
            amountML: amount,
            detail: detail,
            amountUnit: unit,
            milkType: type == "bottle" ? BottleMilkType.fromPayload(milkType) : nil,
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

private struct UnitSettingsResponse: Decodable {
    let unitSettings: UnitSettings

    private enum CodingKeys: String, CodingKey {
        case unitSettings = "unit_settings"
    }
}
