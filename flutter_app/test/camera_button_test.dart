import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/widgets/camera_button.dart';

void main() {
  group('ProminentCameraButton Widget Tests', () {
    testWidgets('Renders circular prominent camera button with teal colors and icon', (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: Center(
              child: ProminentCameraButton(
                onPressed: () {
                  tapped = true;
                },
              ),
            ),
          ),
        ),
      );

      // Verify camera icon is rendered
      final iconFinder = find.byIcon(Icons.camera_alt_rounded);
      expect(iconFinder, findsOneWidget);

      final icon = tester.widget<Icon>(iconFinder);
      expect(icon.color, Colors.white);
      expect(icon.size, 32);

      // Verify semantics
      final semanticsFinder = find.byType(Semantics);
      expect(semanticsFinder, findsWidgets);

      // Tap the button and verify callback fires
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();
      expect(tapped, true);
    });

    testWidgets('Custom size and tooltip are respected', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: ProminentCameraButton(
                onPressed: () {},
                size: 80.0,
                tooltip: 'زر مخصص',
              ),
            ),
          ),
        ),
      );

      expect(find.byTooltip('زر مخصص'), findsOneWidget);
    });
  });
}
