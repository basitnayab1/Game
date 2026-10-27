import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../config/app_routes.dart';

/// Centralized navigation and back-event handler for the N5 Game App.
///
/// Ensures both in-app AppBar Back buttons and Android system Back events
/// behave deterministically and never unexpectedly close the app during
/// active navigation.
class N5Navigation {
  N5Navigation._();

  /// Handles back navigation with safe fallback.
  ///
  /// - If [returnToLobby] is true, routes directly back to the N5 lobby.
  /// - If [onBack] is provided, executes that callback.
  /// - If [context.canPop()] is true, pops the active route.
  /// - Otherwise safely falls back to [fallbackRoute] or the lobby.
  static void handleBack(
    BuildContext context, {
    String? fallbackRoute,
    bool returnToLobby = false,
    VoidCallback? onBack,
  }) {
    if (onBack != null) {
      onBack();
      return;
    }
    if (returnToLobby) {
      context.go(AppRoutes.home);
      return;
    }
    if (context.canPop()) {
      context.pop();
    } else if (fallbackRoute != null && fallbackRoute.isNotEmpty) {
      context.go(fallbackRoute);
    } else {
      context.go(AppRoutes.home);
    }
  }
}

/// Wraps a screen with an Android system Back event interceptor (`PopScope`).
class N5BackScope extends StatelessWidget {
  final Widget child;
  final VoidCallback? onBack;
  final String? fallbackRoute;
  final bool returnToLobby;

  const N5BackScope({
    super.key,
    required this.child,
    this.onBack,
    this.fallbackRoute,
    this.returnToLobby = false,
  });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        N5Navigation.handleBack(
          context,
          fallbackRoute: fallbackRoute,
          returnToLobby: returnToLobby,
          onBack: onBack,
        );
      },
      child: child,
    );
  }
}

/// Standard N5 AppBar Back Button matching branding and safe navigation rules.
class N5BackButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final String? fallbackRoute;
  final bool returnToLobby;
  final Color? color;

  const N5BackButton({
    super.key,
    this.onPressed,
    this.fallbackRoute,
    this.returnToLobby = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back_rounded),
      color: color ?? Colors.white,
      tooltip: 'Back',
      onPressed: () {
        N5Navigation.handleBack(
          context,
          fallbackRoute: fallbackRoute,
          returnToLobby: returnToLobby,
          onBack: onPressed,
        );
      },
    );
  }
}

/// Intercepts Back events on the N5 Lobby to prevent accidental exits.
/// Requires double-tap within 2 seconds to exit the application gracefully.
class N5LobbyBackScope extends StatefulWidget {
  final Widget child;

  const N5LobbyBackScope({super.key, required this.child});

  @override
  State<N5LobbyBackScope> createState() => _N5LobbyBackScopeState();
}

class _N5LobbyBackScopeState extends State<N5LobbyBackScope> {
  DateTime? _lastBackPressTime;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
          return;
        }
        final now = DateTime.now();
        if (_lastBackPressTime == null ||
            now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).removeCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Press back again to exit'),
              duration: Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
            ),
          );
        } else {
          SystemNavigator.pop();
        }
      },
      child: widget.child,
    );
  }
}
