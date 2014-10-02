DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo $DIR
sudo nginx -c "${DIR}/nginx.labnote.conf" 
