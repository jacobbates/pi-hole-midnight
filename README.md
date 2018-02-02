# pi-hole-midnight
Custom dark theme CSS for pi-hole to replace skin-blue AdminLTE theme.

Created for use with [pi-hole](https://github.com/pi-hole/pi-hole).

[![Screenshot](https://i.imgur.com/RxdmXrK.png)](https://i.imgur.com/RxdmXrK.png)

---

## Install
Type the following commands into SSH, line by line.

```
cd /var/www/html/admin/style/vendor/
sudo git clone https://github.com/jacobbates/pi-hole-midnight.git
sudo rm -f skin-blue.min.css
sudo cp pi-hole-midnight/skin-blue.min.css .
sudo rm -rf pi-hole-midnight
```

## Uninstall/Revert
Type the following commands into SSH, line by line.

```
cd /var/www/html/admin/style/vendor/
sudo git reset --hard
```

---

### License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
