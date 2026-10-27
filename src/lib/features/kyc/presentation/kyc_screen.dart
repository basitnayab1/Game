
import 'package:flutter/material.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/kyc_api.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  String status = 'Not Started';
  bool loading = true;
  bool submitting = false;
  String? error;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _cnicController = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() {
    _nameController.dispose();
    _cnicController.dispose();
    super.dispose();
  }

  String _label(String value) => value.replaceAll('_', ' ').split(' ').map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}').join(' ');

  Future<void> _load() async {
    try { final data=await KycApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment())).status(); if(!mounted)return; setState(() { status=_label(data.status); loading=false; error=null; }); } catch (_) { if(!mounted)return; setState(() { loading=false; error='Unable to load verification status'; }); }
  }

  Future<void> _submit() async {
    if(submitting)return; setState(() { submitting=true; error=null; });
    try {
      await KycApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment())).submit(
        fullName: _nameController.text.trim(),
        cnicNumber: _cnicController.text.trim(),
        documentType: 'id_card',
      );
      if(mounted)setState(() { status='In Progress'; submitting=false; });
    } catch (_) {
      if(mounted)setState(() { submitting=false; error='Verification submission could not be started'; });
    }
  }

  final statuses = const [
    'Not Started',
    'In Progress',
    'Verified',
    'Rejected',
    'Additional Information Required',
  ];

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.profile,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.profile),
          title: const Text('KYC Verification'),
        ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (loading) const LinearProgressIndicator(),
          if (error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(error!, style: const TextStyle(color: Colors.red))),
          _statusCard(),
          const SizedBox(height: 16),
          _section(
            title: 'Personal Information',
            icon: Icons.person_outline,
            children: [
              _field('Full Name', 'Enter legal name (as on CNIC)', _nameController),
              _field('CNIC Number', 'e.g. 35202-1234567-1', _cnicController),
              _field('Date of Birth', 'DD / MM / YYYY'),
              _field('Country', 'Pakistan'),
            ],
          ),
          const SizedBox(height: 14),
          _section(
            title: 'Identity Document',
            icon: Icons.badge_outlined,
            children: [
              _field('Document Type', 'ID / Passport / Other approved document'),
              _uploadTile(
                title: 'Front / Main Document',
                subtitle: 'Upload an accepted identity document',
              ),
              _uploadTile(
                title: 'Back / Additional Page',
                subtitle: 'Required where applicable',
              ),
              _uploadTile(
                title: 'Selfie / Liveness',
                subtitle: 'Only if required by the verification provider',
              ),
            ],
          ),
          const SizedBox(height: 14),
          _section(
            title: 'Payment Ownership',
            icon: Icons.account_balance_wallet_outlined,
            children: [
              const Text(
                'Payment method ownership may be verified before certain '
                'financial actions, subject to applicable requirements.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 12),
              _uploadTile(
                title: 'Payment Ownership Evidence',
                subtitle: 'Only when required by the approved provider/process',
              ),
            ],
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: submitting ? null : _submit,
            child: Text(submitting ? 'Submitting...' : 'Submit for Verification'),
          ),
          const SizedBox(height: 10),
          const Text(
            'Documents must be sent to the approved secure verification '
            'service. The client app must never decide verification status.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    ));
  }

  Widget _statusCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            const Icon(Icons.verified_user_outlined, size: 34),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Verification Status',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 5),
                  Text(status,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            const Icon(Icons.lock_outline, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _section({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon),
                const SizedBox(width: 10),
                Text(title,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _field(String label, String hint, [TextEditingController? controller]) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _uploadTile({
    required String title,
    required String subtitle,
  }) {
    return Card(
      elevation: 0,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.upload_file_outlined),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          // Production: use approved secure document-upload flow.
        },
      ),
    );
  }
}
