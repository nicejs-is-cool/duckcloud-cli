apt-get update -y
apt-get upgrade -y
apt-get install -y openssh-server wget
cd ~
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
apt-get install -y -f ./cloudflared-linux-amd64.deb
rm ./cloudflared-linux-amd64.deb
mkdir ~/.ssh
touch /run/sshd
echo "Host $dcli_arg_0" >> ~/.ssh/config
echo "ProxyCommand /usr/local/bin/cloudflared access ssh --hostname %h" >> ~/.ssh/config