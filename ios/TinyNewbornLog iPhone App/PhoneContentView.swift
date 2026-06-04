import SwiftUI

struct PhoneContentView: View {
    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "applewatch")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(.teal)

            Text("Tiny Newborn Log")
                .font(.largeTitle.weight(.bold))
                .multilineTextAlignment(.center)

            Text("Use the Apple Watch app to log sleep, boobie feeds, and milk bottles.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(28)
    }
}

#Preview {
    PhoneContentView()
}
