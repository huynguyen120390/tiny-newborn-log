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

struct PoopColorOption: Identifiable, Hashable {
    let id: String
    let label: String
    let hex: UInt32
    let status: String

    static let all: [PoopColorOption] = [
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
        case .weight: return "lb"
        case .height: return "in"
        }
    }
}

struct UnitSettings: Codable, Equatable {
    var milkUnit: String = "ml"
    var weightUnit: String = "lb"
    var heightUnit: String = "in"

    init(milkUnit: String = "ml", weightUnit: String = "lb", heightUnit: String = "in") {
        self.milkUnit = Self.cleanMilkUnit(milkUnit)
        self.weightUnit = Self.cleanWeightUnit(weightUnit)
        self.heightUnit = Self.cleanHeightUnit(heightUnit)
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            milkUnit: try container.decodeIfPresent(String.self, forKey: .milkUnit) ?? "ml",
            weightUnit: try container.decodeIfPresent(String.self, forKey: .weightUnit) ?? "lb",
            heightUnit: try container.decodeIfPresent(String.self, forKey: .heightUnit) ?? "in"
        )
    }

    func unit(for kind: MeasurementKind) -> String {
        switch kind {
        case .weight: return weightUnit
        case .height: return heightUnit
        }
    }

    private static func cleanMilkUnit(_ value: String) -> String {
        ["ml", "oz"].contains(value) ? value : "ml"
    }

    private static func cleanWeightUnit(_ value: String) -> String {
        ["oz", "lb", "g", "kg"].contains(value) ? value : "lb"
    }

    private static func cleanHeightUnit(_ value: String) -> String {
        ["in", "ft", "cm", "mm"].contains(value) ? value : "in"
    }
}

enum BottleMilkType: String, Codable, CaseIterable, Identifiable {
    case formula = "Formula"
    case breastMilk = "Breast Milk"

    var id: String { rawValue }

    var payloadValue: String {
        switch self {
        case .formula:
            return "formula"
        case .breastMilk:
            return "breast_milk"
        }
    }

    static func fromPayload(_ value: String?) -> BottleMilkType {
        switch value {
        case "breast_milk", "breast milk", "Breast Milk":
            return .breastMilk
        default:
            return .formula
        }
    }
}

struct NewbornLogEntry: Identifiable, Codable, Hashable {
    let id: UUID
    var remoteID: String?
    var kind: LogKind
    var startedAt: Date
    var endedAt: Date?
    var side: NursingSide?
    var amountML: Double?
    var detail: String?
    var amountUnit: String?
    var milkType: BottleMilkType?
    var poopColorID: String?
    var syncState: LogSyncState

    private enum CodingKeys: String, CodingKey {
        case id
        case remoteID
        case kind
        case startedAt
        case endedAt
        case side
        case amountML
        case detail
        case amountUnit
        case milkType
        case poopColorID
        case syncState
    }

    init(
        id: UUID = UUID(),
        remoteID: String? = nil,
        kind: LogKind,
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        side: NursingSide? = nil,
        amountML: Double? = nil,
        detail: String? = nil,
        amountUnit: String? = nil,
        milkType: BottleMilkType? = nil,
        poopColorID: String? = nil,
        syncState: LogSyncState = .pending
    ) {
        self.id = id
        self.remoteID = remoteID
        self.kind = kind
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.side = side
        self.amountML = amountML
        self.detail = detail
        self.amountUnit = amountUnit
        self.milkType = milkType
        self.poopColorID = poopColorID
        self.syncState = syncState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        remoteID = try container.decodeIfPresent(String.self, forKey: .remoteID)
        kind = try container.decode(LogKind.self, forKey: .kind)
        startedAt = try container.decode(Date.self, forKey: .startedAt)
        endedAt = try container.decodeIfPresent(Date.self, forKey: .endedAt)
        side = try container.decodeIfPresent(NursingSide.self, forKey: .side)
        amountML = try container.decodeIfPresent(Double.self, forKey: .amountML)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
        amountUnit = try container.decodeIfPresent(String.self, forKey: .amountUnit)
        milkType = try container.decodeIfPresent(BottleMilkType.self, forKey: .milkType)
        poopColorID = try container.decodeIfPresent(String.self, forKey: .poopColorID)
        syncState = try container.decodeIfPresent(LogSyncState.self, forKey: .syncState) ?? .synced
    }

    var durationSeconds: TimeInterval {
        max((endedAt ?? Date()).timeIntervalSince(startedAt), 0)
    }
}

enum LogSyncState: String, Codable, Hashable {
    case pending
    case synced
}
