import Foundation

enum LogKind: String, Codable, CaseIterable {
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
        case .sleep:
            return "Sleep"
        case .nursing:
            return "Boobie"
        case .bottle:
            return "Bottle"
        case .diaper:
            return "Wee & Poo"
        case .babyStats:
            return "Baby Stats"
        case .bath:
            return "Bath"
        case .tummyTime:
            return "Tummy Time"
        case .outdoorTime:
            return "Outdoor"
        case .babyGym:
            return "Baby Gym"
        case .routines:
            return "Routines"
        }
    }

    var symbolName: String {
        switch self {
        case .sleep:
            return "moon.zzz.fill"
        case .nursing:
            return "heart.fill"
        case .bottle:
            return "drop.fill"
        case .diaper:
            return "drop.triangle.fill"
        case .babyStats:
            return "ruler.fill"
        case .bath:
            return "bathtub.fill"
        case .tummyTime:
            return "figure.child"
        case .outdoorTime:
            return "sun.max.fill"
        case .babyGym:
            return "figure.play"
        case .routines:
            return "checklist"
        }
    }
}

enum NursingSide: String, Codable, CaseIterable, Identifiable {
    case left = "Left"
    case right = "Right"
    case both = "Both"

    var id: String { rawValue }
}

enum DiaperEvent: String, Codable, CaseIterable, Identifiable {
    case wee = "Wee"
    case poo = "Poo"

    var id: String { rawValue }
}

enum RoutineKind: String, Codable, CaseIterable, Identifiable {
    case morning = "Morning routine"
    case naptime = "Naptime routine"
    case bedtime = "Bedtime routine"

    var id: String { rawValue }

    var payloadValue: String {
        switch self {
        case .morning:
            return "morning"
        case .naptime:
            return "naptime"
        case .bedtime:
            return "bedtime"
        }
    }
}

enum MeasurementKind: String, Codable, CaseIterable, Identifiable {
    case weight = "Weight"
    case height = "Height"

    var id: String { rawValue }

    var unit: String {
        switch self {
        case .weight:
            return "lb"
        case .height:
            return "in"
        }
    }
}

struct NewbornLogEntry: Identifiable, Codable, Hashable {
    let id: UUID
    var kind: LogKind
    var startedAt: Date
    var endedAt: Date?
    var side: NursingSide?
    var amountML: Double?
    var detail: String?
    var amountUnit: String?

    init(
        id: UUID = UUID(),
        kind: LogKind,
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        side: NursingSide? = nil,
        amountML: Double? = nil,
        detail: String? = nil,
        amountUnit: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.side = side
        self.amountML = amountML
        self.detail = detail
        self.amountUnit = amountUnit
    }

    var durationSeconds: TimeInterval {
        max((endedAt ?? Date()).timeIntervalSince(startedAt), 0)
    }
}
