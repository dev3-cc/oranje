import AVFoundation
import Capacitor
import CoreLocation
import CoreText
import UIKit

/*
 * La pantalla NATIVA de Permisos de la app del Colaborador, en iOS. Es el
 * espejo de Android (`PermissionsStatus`, `PermissionsActivity` y
 * `OranjePermissionsPlugin` en `android/app/src/main/java/...`): mismos
 * estados, mismos textos y el mismo contrato con el WebView. Si uno cambia,
 * cambia el otro.
 *
 * Todo vive en este archivo a propósito: es UN solo renglón en
 * `project.pbxproj`.
 *
 * ⚠️ Escrito sin Xcode (la Mac del equipo tiene macOS 12, y Capacitor 7 pide
 * Xcode 16). Compilar y probar en un Mac con Xcode 16+ antes de publicar.
 */

// MARK: - Registro

/// El `CAPBridgeViewController` de la app: el mismo, más el plugin local.
/// `Main.storyboard` apunta aquí en vez de a la clase de Capacitor.
class OranjeBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OranjePermissionsPlugin())
    }
}

// MARK: - Plugin

/// check() → { location, camera, gps, ready } · open({ firstName, locale }) →
/// al cerrar, { action: "punch" | "home", ...estado } (iOS no tiene «atrás»:
/// la pantalla es modal y se cierra con sus botones) · evento
/// "permissionsChanged" al volver la app al frente. Del lado web lo llama
/// `features/worker/lib/nativePermissions.ts`.
@objc(OranjePermissionsPlugin)
public class OranjePermissionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OranjePermissionsPlugin"
    public let jsName = "OranjePermissions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "check", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc func check(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(PermissionsStatus.current().js)
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        let firstName = call.getString("firstName") ?? ""
        let locale = call.getString("locale") ?? "es"
        DispatchQueue.main.async { [weak self] in
            let screen = PermissionsViewController(firstName: firstName, locale: locale) { action in
                var result = PermissionsStatus.current().js
                result["action"] = action
                call.resolve(result)
            }
            guard let presenter = self?.bridge?.viewController else {
                call.reject("No hay una pantalla sobre la cual abrir Permisos")
                return
            }
            presenter.present(screen, animated: true)
        }
    }

    @objc private func appDidBecomeActive() {
        notifyListeners("permissionsChanged", data: PermissionsStatus.current().js)
    }
}

// MARK: - Estado

/// Lo que el ponche necesita, leído del sistema. Mismos valores que Android:
/// granted · prompt (se puede pedir) · denied (solo desde Ajustes) ·
/// approximate (ubicación sin «Ubicación exacta»: la geocerca puede fallar).
struct PermissionsStatus {
    let location: String
    let camera: String
    let gps: Bool

    var ready: Bool { location == "granted" && camera == "granted" && gps }

    var js: [String: Any] {
        ["location": location, "camera": camera, "gps": gps, "ready": ready]
    }

    static func current() -> PermissionsStatus {
        PermissionsStatus(location: locationState(), camera: cameraState(), gps: CLLocationManager.locationServicesEnabled())
    }

    private static func cameraState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "granted"
        case .notDetermined: return "prompt"
        default: return "denied"
        }
    }

    private static func locationState() -> String {
        let manager = CLLocationManager()
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            return manager.accuracyAuthorization == .reducedAccuracy ? "approximate" : "granted"
        case .notDetermined:
            return "prompt"
        default:
            /* En iOS no hay segunda oportunidad: negado (o restringido) solo se
               revierte desde Ajustes. */
            return "denied"
        }
    }
}

// MARK: - Textos

/// Los textos de la pantalla. Mismas claves y redacción que
/// `res/values*/oranje_permissions_strings.xml` en Android. El idioma es el
/// del worker (D-36), no el del teléfono: por eso no son `.lproj`.
private enum Copy {
    static func text(_ key: String, _ locale: String) -> String {
        (locale == "en" ? english : spanish)[key] ?? spanish[key] ?? key
    }

    static let spanish: [String: String] = [
        "eyebrow": "PERMISOS",
        "greeting": "Hola, %@",
        "greeting_anonymous": "Hola",
        "summary_ready": "Todo listo para ponchar.",
        "summary_missing": "Antes de ponchar, activa lo que falta.",
        "location_title": "Ubicación",
        "location_body": "Confirma que estás en el hotel cuando ponchas. Solo se usa en ese momento.",
        "gps_title": "GPS del teléfono",
        "gps_body": "Sin el GPS encendido el teléfono no puede dar tu ubicación, aunque la app tenga permiso.",
        "camera_title": "Cámara",
        "camera_body": "Para tu foto de Entrada y Salida, y para leer el código QR del hotel.",
        "state_granted": "Permitido",
        "state_missing": "Sin permiso",
        "state_blocked": "Bloqueado",
        "state_approximate": "Solo aproximada",
        "state_on": "Encendido",
        "state_off": "Apagado",
        "hint_blocked": "Lo negaste antes: ahora solo se activa desde la configuración del teléfono.",
        "hint_approximate": "Con la ubicación aproximada el sistema puede creer que estás fuera del hotel. En Ajustes, activa «Ubicación exacta».",
        "hint_gps": "Enciéndelo en Ajustes › Privacidad y seguridad › Localización.",
        "action_grant": "Dar permiso",
        "action_settings": "Abrir configuración",
        "punch": "Ponchar",
        "punch_locked": "Activa los permisos de arriba para poder ponchar.",
        "go_home": "Ir a Inicio"
    ]

    static let english: [String: String] = [
        "eyebrow": "PERMISSIONS",
        "greeting": "Hi, %@",
        "greeting_anonymous": "Hi",
        "summary_ready": "You're all set to punch.",
        "summary_missing": "Before punching, turn on what's missing.",
        "location_title": "Location",
        "location_body": "Confirms you're at the hotel when you punch. It's only used at that moment.",
        "gps_title": "Phone GPS",
        "gps_body": "With GPS off your phone can't tell where you are, even if the app has permission.",
        "camera_title": "Camera",
        "camera_body": "For your Clock-in and Clock-out photo, and to read the hotel's QR code.",
        "state_granted": "Allowed",
        "state_missing": "Not allowed",
        "state_blocked": "Blocked",
        "state_approximate": "Approximate only",
        "state_on": "On",
        "state_off": "Off",
        "hint_blocked": "You denied it before: now it can only be turned on from your phone's settings.",
        "hint_approximate": "With approximate location the system may think you're outside the hotel. In Settings, turn on \"Precise Location\".",
        "hint_gps": "Turn it on in Settings › Privacy & Security › Location Services.",
        "action_grant": "Allow",
        "action_settings": "Open settings",
        "punch": "Punch",
        "punch_locked": "Turn on the permissions above to punch.",
        "go_home": "Go to Home"
    ]
}

// MARK: - Diseño

/// Espejo de `packages/ui/src/styles/tokens.css`, como `oranje_colors.xml` en Android.
private enum Palette {
    static let o50 = UIColor(hex: 0xFFF6E8)
    static let o300 = UIColor(hex: 0xFFA64D)
    static let o400 = UIColor(hex: 0xFF9933)
    static let o700 = UIColor(hex: 0xC85F00)
    static let bg = UIColor(hex: 0xF6F4F1)
    static let surface = UIColor(hex: 0xFFFFFF)
    static let line = UIColor(hex: 0xE3DDD5)
    static let ink = UIColor(hex: 0x1A1108)
    static let ink2 = UIColor(hex: 0x4A3F35)
    static let ink3 = UIColor(hex: 0x7A6D60)
    static let green = UIColor(hex: 0x1FA84A)
    static let red = UIColor(hex: 0xE11919)
    static let yellow = UIColor(hex: 0xFFD500)
}

private extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

/// Montserrat, la misma del web. Los .ttf viajan en la carpeta `Fonts` del
/// bundle y se registran al primer uso; así no hace falta adivinar su nombre
/// PostScript ni listarlos en `Info.plist`. Sin ellos, la del sistema.
private enum Montserrat {
    private static let names: [Int: String] = {
        var names: [Int: String] = [:]
        for weight in [400, 500, 600, 700] {
            guard
                let url = Bundle.main.url(forResource: "montserrat_\(weight)", withExtension: "ttf", subdirectory: "Fonts"),
                let provider = CGDataProvider(url: url as CFURL),
                let font = CGFont(provider),
                let name = font.postScriptName as String?
            else { continue }
            CTFontManagerRegisterGraphicsFont(font, nil)
            names[weight] = name
        }
        return names
    }()

    static func font(_ weight: Int, _ size: CGFloat) -> UIFont {
        if let name = names[weight], let font = UIFont(name: name, size: size) { return font }
        let system: UIFont.Weight = weight >= 700 ? .bold : weight >= 600 ? .semibold : weight >= 500 ? .medium : .regular
        return .systemFont(ofSize: size, weight: system)
    }
}

// MARK: - Pantalla

final class PermissionsViewController: UIViewController, CLLocationManagerDelegate {
    private let firstName: String
    private let locale: String
    private let onClose: (String) -> Void
    private let locationManager = CLLocationManager()
    private var didClose = false

    private let summary = UILabel()
    private let punchLocked = UILabel()
    private let punch = UIButton(type: .system)
    private let locationCard = PermissionCard()
    private let gpsCard = PermissionCard()
    private let cameraCard = PermissionCard()

    init(firstName: String, locale: String, onClose: @escaping (String) -> Void) {
        self.firstName = firstName.trimmingCharacters(in: .whitespaces)
        self.locale = locale
        self.onClose = onClose
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        isModalInPresentation = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) no se usa") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    private func text(_ key: String) -> String { Copy.text(key, locale) }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = Palette.surface
        locationManager.delegate = self
        buildLayout()
        render()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(render),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    // MARK: Layout

    private func buildLayout() {
        /* Encabezado: el logo sobre blanco y la raya `line`, como el shell del worker. */
        let logo = UIImageView(image: UIImage(named: "OranjeLogo"))
        logo.contentMode = .scaleAspectFit
        logo.accessibilityLabel = "Oranje"
        logo.isAccessibilityElement = true
        let header = UIView()
        header.addSubview(logo)
        logo.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            logo.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 20),
            logo.topAnchor.constraint(equalTo: header.topAnchor, constant: 18),
            logo.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -18),
            logo.widthAnchor.constraint(equalToConstant: 128),
            logo.heightAnchor.constraint(equalToConstant: 12)
        ])

        /* Cuerpo desplazable sobre `bg`. */
        let eyebrow = label(text("eyebrow"), Montserrat.font(700, 12), Palette.o700)
        eyebrow.attributedText = NSAttributedString(string: text("eyebrow"), attributes: [.kern: 1.0])
        let greeting = label(
            firstName.isEmpty ? text("greeting_anonymous") : String(format: text("greeting"), firstName),
            Montserrat.font(700, 24),
            Palette.ink
        )
        style(summary, Montserrat.font(500, 14), Palette.ink2)

        locationCard.setup(icon: "location.fill", title: text("location_title"), body: text("location_body"))
        gpsCard.setup(icon: "scope", title: text("gps_title"), body: text("gps_body"))
        cameraCard.setup(icon: "camera.fill", title: text("camera_title"), body: text("camera_body"))

        let content = UIStackView(arrangedSubviews: [eyebrow, greeting, summary, locationCard, gpsCard, cameraCard])
        content.axis = .vertical
        content.spacing = 12
        content.setCustomSpacing(6, after: eyebrow)
        content.setCustomSpacing(4, after: greeting)
        content.setCustomSpacing(20, after: summary)
        content.isLayoutMarginsRelativeArrangement = true
        content.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 24, leading: 20, bottom: 24, trailing: 20)

        let scroll = UIScrollView()
        scroll.backgroundColor = Palette.bg
        scroll.alwaysBounceVertical = true
        scroll.addSubview(content)
        content.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor)
        ])

        /* Pie fijo: el aviso del candado, «Ponchar» y «Ir a Inicio». */
        style(punchLocked, Montserrat.font(500, 13), Palette.ink3)
        punchLocked.text = text("punch_locked")
        punchLocked.textAlignment = .center

        var punchConfig = UIButton.Configuration.filled()
        punchConfig.baseBackgroundColor = Palette.o300
        punchConfig.baseForegroundColor = Palette.ink
        punchConfig.background.cornerRadius = 12
        punchConfig.image = UIImage(systemName: "touchid")
        punchConfig.imagePadding = 10
        punchConfig.attributedTitle = AttributedString(text("punch"), attributes: AttributeContainer([.font: Montserrat.font(600, 16)]))
        punch.configuration = punchConfig
        punch.configurationUpdateHandler = { button in
            button.configuration?.background.backgroundColor = button.isHighlighted ? Palette.o400 : Palette.o300
            button.alpha = button.isEnabled ? 1 : 0.5
        }
        punch.heightAnchor.constraint(equalToConstant: 56).isActive = true
        punch.addAction(UIAction { [weak self] _ in
            /* Doble candado: el botón ya está deshabilitado, pero se verifica al tocar. */
            if PermissionsStatus.current().ready { self?.close("punch") }
        }, for: .touchUpInside)

        var homeConfig = UIButton.Configuration.plain()
        homeConfig.baseForegroundColor = Palette.ink2
        homeConfig.attributedTitle = AttributedString(text("go_home"), attributes: AttributeContainer([.font: Montserrat.font(600, 15)]))
        let home = UIButton(configuration: homeConfig)
        home.heightAnchor.constraint(equalToConstant: 48).isActive = true
        home.addAction(UIAction { [weak self] _ in self?.close("home") }, for: .touchUpInside)

        let footer = UIStackView(arrangedSubviews: [punchLocked, punch, home])
        footer.axis = .vertical
        footer.spacing = 12
        footer.setCustomSpacing(4, after: punch)
        footer.isLayoutMarginsRelativeArrangement = true
        footer.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 16, leading: 20, bottom: 12, trailing: 20)

        let page = UIStackView(arrangedSubviews: [header, divider(), scroll, divider(), footer])
        page.axis = .vertical
        view.addSubview(page)
        page.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            page.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            page.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            page.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            page.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
    }

    private func label(_ string: String, _ font: UIFont, _ color: UIColor) -> UILabel {
        let label = UILabel()
        label.text = string
        style(label, font, color)
        return label
    }

    private func style(_ label: UILabel, _ font: UIFont, _ color: UIColor) {
        label.font = font
        label.textColor = color
        label.numberOfLines = 0
    }

    private func divider() -> UIView {
        let line = UIView()
        line.backgroundColor = Palette.line
        line.heightAnchor.constraint(equalToConstant: 1).isActive = true
        return line
    }

    // MARK: Estado

    @objc private func render() {
        let status = PermissionsStatus.current()

        switch status.location {
        case "granted":
            locationCard.bind(.ok, text("state_granted"))
        case "approximate":
            locationCard.bind(.warn, text("state_approximate"), hint: text("hint_approximate"),
                              action: text("action_settings"), handler: Self.openAppSettings)
        case "prompt":
            locationCard.bind(.warn, text("state_missing"), action: text("action_grant")) { [weak self] in
                self?.locationManager.requestWhenInUseAuthorization()
            }
        default:
            locationCard.bind(.error, text("state_blocked"), hint: text("hint_blocked"),
                              action: text("action_settings"), handler: Self.openAppSettings)
        }

        /* iOS no deja abrir el interruptor general de Localización desde una
           app: se dice dónde está y se abre Ajustes. */
        if status.gps {
            gpsCard.bind(.ok, text("state_on"))
        } else {
            gpsCard.bind(.error, text("state_off"), hint: text("hint_gps"),
                         action: text("action_settings"), handler: Self.openAppSettings)
        }

        switch status.camera {
        case "granted":
            cameraCard.bind(.ok, text("state_granted"))
        case "prompt":
            cameraCard.bind(.warn, text("state_missing"), action: text("action_grant")) { [weak self] in
                AVCaptureDevice.requestAccess(for: .video) { _ in
                    DispatchQueue.main.async { self?.render() }
                }
            }
        default:
            cameraCard.bind(.error, text("state_blocked"), hint: text("hint_blocked"),
                            action: text("action_settings"), handler: Self.openAppSettings)
        }

        summary.text = text(status.ready ? "summary_ready" : "summary_missing")
        punchLocked.isHidden = status.ready
        punch.isEnabled = status.ready
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        render()
    }

    private static func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func close(_ action: String) {
        guard !didClose else { return }
        didClose = true
        dismiss(animated: true) { [onClose] in onClose(action) }
    }
}

// MARK: - Tarjeta

/// Una tarjeta de permiso: icono, qué es, su estado (chip) y, si falta, qué
/// hacer. Mismo diseño que `item_permission_card.xml` en Android.
private final class PermissionCard: UIView {
    enum Tone { case ok, warn, error }

    private let icon = UIImageView()
    private let title = UILabel()
    private let chip = PaddedLabel()
    private let body = UILabel()
    private let hint = UILabel()
    private let action = UIButton(type: .system)
    private var handler: (() -> Void)?

    init() {
        super.init(frame: .zero)
        backgroundColor = Palette.surface
        layer.cornerRadius = 18
        layer.borderWidth = 1
        layer.borderColor = Palette.line.cgColor

        icon.tintColor = Palette.o700
        icon.contentMode = .scaleAspectFit
        let iconCircle = UIView()
        iconCircle.backgroundColor = Palette.o50
        iconCircle.layer.cornerRadius = 22
        iconCircle.addSubview(icon)
        icon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            iconCircle.widthAnchor.constraint(equalToConstant: 44),
            iconCircle.heightAnchor.constraint(equalToConstant: 44),
            icon.centerXAnchor.constraint(equalTo: iconCircle.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconCircle.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22)
        ])

        title.font = Montserrat.font(600, 15)
        title.textColor = Palette.ink
        chip.font = Montserrat.font(600, 12)
        chip.textColor = Palette.ink
        chip.layer.cornerRadius = 12
        chip.layer.masksToBounds = true
        chip.setContentHuggingPriority(.required, for: .horizontal)
        chip.setContentCompressionResistancePriority(.required, for: .horizontal)

        let row = UIStackView(arrangedSubviews: [iconCircle, title, chip])
        row.alignment = .center
        row.spacing = 12

        body.font = Montserrat.font(400, 14)
        body.textColor = Palette.ink2
        body.numberOfLines = 0
        hint.font = Montserrat.font(500, 13)
        hint.textColor = Palette.ink
        hint.numberOfLines = 0

        var config = UIButton.Configuration.plain()
        config.baseForegroundColor = Palette.ink
        config.background.backgroundColor = Palette.surface
        config.background.strokeColor = Palette.line
        config.background.strokeWidth = 1
        config.background.cornerRadius = 12
        action.configuration = config
        action.heightAnchor.constraint(equalToConstant: 48).isActive = true
        action.addAction(UIAction { [weak self] _ in self?.handler?() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [row, body, hint, action])
        stack.axis = .vertical
        stack.spacing = 12
        stack.setCustomSpacing(8, after: body)
        addSubview(stack)
        stack.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) no se usa") }

    func setup(icon systemName: String, title: String, body: String) {
        icon.image = UIImage(systemName: systemName)
        self.title.text = title
        self.body.text = body
    }

    func bind(_ tone: Tone, _ state: String, hint: String? = nil, action: String? = nil, handler: (() -> Void)? = nil) {
        let (background, symbol, tint): (UIColor, String, UIColor) = {
            switch tone {
            case .ok: return (Palette.green.withAlphaComponent(0.15), "checkmark.circle.fill", Palette.green)
            case .warn: return (Palette.yellow.withAlphaComponent(0.25), "exclamationmark.circle.fill", Palette.o700)
            case .error: return (Palette.red.withAlphaComponent(0.12), "nosign", Palette.red)
            }
        }()
        chip.backgroundColor = background
        let glyph = NSTextAttachment()
        glyph.image = UIImage(systemName: symbol)?.withTintColor(tint, renderingMode: .alwaysOriginal)
        glyph.bounds = CGRect(x: 0, y: -3, width: 14, height: 14)
        let label = NSMutableAttributedString(attachment: glyph)
        label.append(NSAttributedString(string: "  " + state))
        chip.attributedText = label

        self.hint.text = hint
        self.hint.isHidden = hint == nil
        self.handler = handler
        self.action.isHidden = action == nil
        if let action {
            self.action.configuration?.attributedTitle = AttributedString(
                action, attributes: AttributeContainer([.font: Montserrat.font(600, 15)])
            )
        }
    }
}

/// Un `UILabel` con relleno, para el chip de estado.
private final class PaddedLabel: UILabel {
    private let insets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 10)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + insets.left + insets.right, height: size.height + insets.top + insets.bottom)
    }
}
