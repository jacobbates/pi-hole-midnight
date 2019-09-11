#!/bin/bash
while true; do
    read -p "Create a backup of the current files? (Y/n): " yn
    case $yn in
        [Yy]* ) 
            cp -f admin/style/vendor/skin-blue.min.css admin/style/vendor/skin-blue.min.bkp.css  # Backup Skin StyleSheet...
            cp -f admin/style/vendor/daterangepicker.css admin/style/vendor/daterangepicker.bkp.css  # Backup Calendar StyleSheet...
            cp -f admin/scripts/vendor/app.min.js admin/scripts/vendor/app.min.bkp.js # Backup app.js
            cp -f admin/scripts/pi-hole/js/index.js admin/scripts/pi-hole/js/index.bkp.js # Backup index.js
            echo "Backup completed!"
			break ;;
        [Nn]* ) break;;
        * ) echo "Please answer Yes (y) or No (n).";;
    esac
done
while true; do
    read -p "Install MBarrows20's Material Dark Theme now? (Y/n): " yn
    case $yn in
        [Yy]* ) 
	    git clone https://github.com/mbarrows20/pi-hole-material-dark.git temp
            cd temp
            git checkout feature_graphicColors
            cd ..
            rm -f admin/style/vendor/skin-blue.min.css
            rm -f admin/style/vendor/daterangepicker.css
            rm -f admin/scripts/vendor/app.min.js
            rm -f admin/scripts/pi-hole/js/index.js
            cp temp/style/vendor/skin-blue.min.css admin/style/vendor/skin-blue.min.css
            cp temp/style/vendor/daterangepicker.css admin/style/vendor/daterangepicker.css
            cp temp/scripts/vendor/app.min.js admin/scripts/vendor/app.min.js
            cp temp/scripts/pi-hole/js/index.js admin/scripts/pi-hole/js/index.js
	    rm -rf temp/
			break;;
        [Nn]* ) break;;
        * ) echo "Please answer Yes (y) or No (n).";;
    esac
done
echo "All done!"