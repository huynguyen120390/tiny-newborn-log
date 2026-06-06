import SwiftUI
import WatchConnectivity
import UserNotifications

final class PhoneSyncNotifier: NSObject, WCSessionDelegate {
    static let shared = PhoneSyncNotifier()

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else {
            return
        }

        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendTransferredLogs(_ titles: [String]) {
        guard WCSession.default.activationState == .activated else {
            return
        }

        WCSession.default.transferUserInfo([
            "event": "logsSynced",
            "titles": titles,
            "count": titles.count
        ])
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}

final class WatchNotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = WatchNotificationPresenter()

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

@main
struct TinyNewbornLogApp: App {
    init() {
        UNUserNotificationCenter.current().delegate = WatchNotificationPresenter.shared
        PhoneSyncNotifier.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
