import SwiftUI

struct PhoneContentView: View {
    var body: some View {
        VStack(spacing: 18) {
            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

            Text("TinyNewbornLog")
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
