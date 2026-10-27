# N5 External QA Commands

From repository root:

```bash
flutter --version
flutter create --platforms android,web --no-pub .
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release
flutter build appbundle --release
flutter build web
```

Backend:

```bash
cd backend
npm install
npm run typecheck
npm test
npm run build
```

Do not edit application source during this verification pass. Report exact failures with
command, path, line number, and message.
