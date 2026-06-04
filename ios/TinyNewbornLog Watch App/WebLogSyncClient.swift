import Foundation

actor WebLogSyncClient {
    static let shared = WebLogSyncClient()

    private let baseURL = URL(string: "http://192.168.86.55:3002")!

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
            "notes": "Bottle feed"
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
        let url = baseURL.appending(path: "api/logs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
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
