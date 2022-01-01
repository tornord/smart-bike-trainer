# Bluetooth setup

Run this on Linux (to avoid running as sudo):
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
