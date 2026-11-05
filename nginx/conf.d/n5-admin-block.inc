# The admin panel and admin API are served only on admin.n5gamez.com.
# Every other host (landing page, player API, IP/sslip address) answers 404.
location ~ ^/(admin|admin-portal|dashboard)(/|$) {
    return 404;
}
location ^~ /api/v1/admin {
    return 404;
}
