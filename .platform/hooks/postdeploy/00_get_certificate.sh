#!/usr/bin/env bash
# .platform/hooks/postdeploy/00_get_certificate.sh
## uncomment the line below to get a cert for the site
sudo certbot -n -d ellarises-3-7.is404.net --nginx --agree-tos --email will@hollandfam.com