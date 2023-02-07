apt-get update -y
apt-get upgrade -y
apt-get install -y openssh-server wget xz-utils proxychains-ng
cd ~
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
apt-get install -y -f ./cloudflared-linux-amd64.deb
rm ./cloudflared-linux-amd64.deb
mkdir ~/.ssh
touch /run/sshd
echo "Host ssh.nicejsisverycool.ml" >> ~/.ssh/config
echo "ProxyCommand /usr/local/bin/cloudflared access ssh --hostname %h" >> ~/.ssh/config
sed -i '$ d' /etc/proxychains4.conf
sed -i '$ d' /etc/proxychains4.conf # just to make sure
echo "socks5 127.0.0.1 8081" >> /etc/proxychains4.conf
printf "%s/bin/bash\n" "#!" > ~/startsshsocks
echo "ssh -fNTD 127.0.0.1:8081 amogus@ssh.example.com" >> ~/startsshsocks
chmod +x ~/startsshsocks