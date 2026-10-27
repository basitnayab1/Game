
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';

class SecurityDevicesScreen extends StatelessWidget {
  const SecurityDevicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('Security & Devices'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _securityStatus(),
          const SizedBox(height: 16),
          _section(
            title: 'Account Security',
            children: [
              _item(
                context,
                Icons.lock_outline,
                'Change Password',
                'Update your account password',
                const ChangePasswordScreen(),
              ),
              _item(
                context,
                Icons.password_outlined,
                'OTP / Verification',
                'Manage verification and security checks',
                const OtpSecurityScreen(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _section(
            title: 'Devices & Sessions',
            children: [
              _item(
                context,
                Icons.devices_outlined,
                'Active Devices',
                'Review devices currently signed in',
                const ActiveDevicesScreen(),
              ),
              _item(
                context,
                Icons.history,
                'Login History',
                'Review recent sign-in activity',
                const LoginHistoryScreen(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Logout Other Devices'),
              subtitle: const Text('End other active sessions'),
              onTap: () => _confirmLogout(context),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const Icon(Icons.warning_amber_outlined),
              title: const Text('Security Alerts'),
              subtitle: const Text('Suspicious activity will be shown here'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const SecurityAlertsScreen(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Security decisions and session revocation must be enforced by '
            'the backend. The client app must not be the authority for '
            'authentication or account security.',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    ),
    );
  }

  Widget _securityStatus() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: const [
            Icon(Icons.verified_user_outlined, size: 36),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Security Status',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  SizedBox(height: 5),
                  Text('Account protected',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section({
    required String title,
    required List<Widget> children,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w700)),
            ),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _item(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    Widget screen,
  ) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => screen),
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Logout Other Devices?'),
        content: const Text(
          'Other active sessions will be revoked after backend confirmation.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordScreen extends StatelessWidget {
  const ChangePasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('Change Password'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Current Password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New Password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Confirm New Password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {},
              child: const Text('Update Password'),
            ),
          ],
        ),
      ),
    );
  }
}

class OtpSecurityScreen extends StatelessWidget {
  const OtpSecurityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('OTP & Verification'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            ListTile(
              leading: Icon(Icons.phone_android),
              title: Text('Phone Verification'),
              subtitle: Text('Backend status required'),
            ),
            ListTile(
              leading: Icon(Icons.security),
              title: Text('Login Verification'),
              subtitle: Text('Additional verification when required'),
            ),
            ListTile(
              leading: Icon(Icons.timer_outlined),
              title: Text('Rate Limits'),
              subtitle: Text('Repeated attempts are restricted server-side'),
            ),
          ],
        ),
      ),
    );
  }
}

class ActiveDevicesScreen extends StatelessWidget {
  const ActiveDevicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('Active Devices'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            Card(
              child: ListTile(
                leading: Icon(Icons.phone_android),
                title: Text('Current Android Device'),
                subtitle: Text('Current session • Backend data required'),
                trailing: Icon(Icons.verified_user_outlined),
              ),
            ),
            SizedBox(height: 8),
            Center(child: Text('Other active devices will appear here.')),
          ],
        ),
      ),
    );
  }
}

class LoginHistoryScreen extends StatelessWidget {
  const LoginHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('Login History'),
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'No login history loaded.\nProduction data comes from the backend.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

class SecurityAlertsScreen extends StatelessWidget {
  const SecurityAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.security,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.security),
          title: const Text('Security Alerts'),
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'No security alerts.\nSuspicious events will appear here.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
