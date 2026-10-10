import UIKit
import Capacitor

/*
 * iOS 27 mata al arrancar (SIGTRAP en `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`)
 * cualquier app que no adopte el ciclo de vida de escenas. La plantilla de Capacitor 7
 * solo trae `AppDelegate`, así que la escena se declara en `Info.plist`
 * (`UIApplicationSceneManifest`), que carga `Main.storyboard` —y con él
 * `OranjeBridgeViewController`— igual que antes lo hacía `UIMainStoryboardFile`.
 *
 * Con escenas, iOS entrega los enlaces a este delegado y no al `AppDelegate`: se
 * reenvían a `ApplicationDelegateProxy` para que el API `App` de Capacitor los siga viendo.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let context = connectionOptions.urlContexts.first {
            openURL(context)
        }
        if let activity = connectionOptions.userActivities.first {
            continueActivity(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let context = URLContexts.first {
            openURL(context)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    private func openURL(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        options[.sourceApplication] = context.options.sourceApplication
        options[.annotation] = context.options.annotation
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
    }

    private func continueActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}
