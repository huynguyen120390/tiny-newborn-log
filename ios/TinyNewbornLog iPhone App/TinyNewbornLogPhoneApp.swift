import SwiftUI
import UserNotifications
import WatchConnectivity

final class WatchSyncNotificationReceiver: NSObject, WCSessionDelegate, UNUserNotificationCenterDelegate {
    static let shared = WatchSyncNotificationReceiver()

    private override init() {
        super.init()
    }

    func activate() {
        UNUserNotificationCenter.current().delegate = self

        Task {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        }

        guard WCSession.isSupported() else {
            return
        }

        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard userInfo["event"] as? String == "logsSynced" else {
            return
        }

        let titles = userInfo["titles"] as? [String] ?? []
        let count = userInfo["count"] as? Int ?? titles.count
        let content = UNMutableNotificationContent()
        content.title = count == 1 ? "Log synced" : "\(count) logs synced"
        content.body = titles.isEmpty ? "Transferred to server." : titles.joined(separator: ", ")
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "watch-sync-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

@main
struct TinyNewbornLogPhoneApp: App {
    init() {
        WatchSyncNotificationReceiver.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            PhoneContentView()
        }
    }
}
