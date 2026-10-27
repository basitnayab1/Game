import 'package:flutter_test/flutter_test.dart';
import 'package:n5_game/main.dart';
void main() {
  testWidgets('N5 app boots with canonical router', (tester) async {
    await tester.pumpWidget(const N5GameApp());
    expect(find.text('N5 GAME'), findsOneWidget); // canonical splash branding is visible on initial boot
  });
}
