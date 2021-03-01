cd ~/
sudo apt-get update -y && apt-get upgrade -y
sudo apt-get install -y git npm nodejs apache2 python python3
sudo rm -rf /var/www/html/*
git clone https://github.com/nasa/openmct.git
git clone https://github.com/A731/telemetry-server.git ~/.temp
cd openmct
npm install
npm install express
npm install express-ws
npm install node-fetch
npm install local-ip
npm install -g node-gyp
npm install -g node-pre-gyp
npm install serialport --unsafe-perm
npm install -g pm2
sudo mv -R ~/openmct/* /var/www/html/
sudo cp -R /var/www/html/dist/* /var/www/html/
cd /var/www/html/
cd /var/www/html/node-modules/serialport
sudo node-gyp configure build
cd /var/www/html/
sudo cp ~/.temp/* /var/www/html/
mv /var/www/html/CUSTOM.conf /etc/apache2/conf-available/
sudo rm -rf /var/www/.temp
sudo pm2 start /var/www/html/server.js
sudo pm2 startup systemd
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enconf CUSTOM
sudo service apache2 restart
echo "\nDone!\n"
