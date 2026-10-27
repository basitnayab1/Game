import 'package:flutter_test/flutter_test.dart';
import 'package:n5_game/canonical_merge_map.dart';

void main() {
  test('N5 has exactly five final player languages', () {
    expect(N5CanonicalMergeMap.supportedLocales, hasLength(5));
    expect(N5CanonicalMergeMap.supportedLocales,
        containsAll(<String>['en', 'tr', 'hi', 'ur', 'ar']));
  });

  test('N5 uses versioned API prefix', () {
    expect(N5CanonicalMergeMap.apiPrefix, '/api/v1');
  });
}
