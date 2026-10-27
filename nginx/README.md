# N5 HTTPS Reverse Proxy Configuration

Yeh directory N5 Casino platform ke production HTTPS reverse proxy (Nginx) ki configuration aur SSL certificates hold karti hai.

## 📁 Directory Structure
- `nginx.conf`: Nginx core configuration (worker processes, gzip, websocket upgrade map).
- `conf.d/default.conf`: Virtual host configuration:
  - Port 80: Health check (`/nginx-health`) & 301 Permanent Redirect to HTTPS (Port 443).
  - Port 443: SSL termination, TLSv1.2/TLSv1.3 modern ciphers, HSTS, security headers, reverse proxy to `app:8080`, and WebSocket upgrade.
- `ssl/`: TLS certificates (`server.crt` aur `server.key`).

## 🔒 Production SSL Setup (Let's Encrypt / Certbot)
Production mein apna valid domain SSL certificate use karein:

```bash
# Using Certbot standalone:
certbot certonly --standalone -d yourdomain.com -d admin.yourdomain.com

# Copy certificates into nginx/ssl/:
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/n5-casino/nginx/ssl/server.crt
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/n5-casino/nginx/ssl/server.key
chmod 600 /opt/n5-casino/nginx/ssl/server.key
docker compose restart proxy
```

## 🧪 Development Self-Signed Certificate Renewal
Local ya development testing ke liye self-signed certificate generate karne ke liye:
```bash
docker run --rm -v "${PWD}/nginx/ssl:/ssl" alpine sh -c \
  "apk add --no-cache openssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /ssl/server.key -out /ssl/server.crt -subj '/CN=localhost'"
```
