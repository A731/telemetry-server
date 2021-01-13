apt-get update -y && apt-get upgrade -y
apt-get install -y git npm nodejs apache2
rm -rf /var/www/html/*
cd /var/www/html/
git clone https://github.com/A731/telemetry-server.git /var/www/.temp
npm install openmct
npm install express
npm install express-ws
npm install node-fetch
npm install -g node-gyp
npm install -g node-pre-gyp
npm install serialport --unsafe-perm
npm install -g pm2
mv CUSTOM.conf /etc/apache2/mods-available
cd /var/www/html/node-modules/serialport
node-gyp configure build
cd /var/www/html/
cp /var/www/.temp/* /var/www/html/
rm -rf /var/www/.temp
pm2 start /var/www/html/server.js
pm2 startup systemd
a2enmod mod_proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enconf CUSTOM
service apache2 restart
echo "\nDone!\n"
