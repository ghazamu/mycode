import hashlib
import requests
import datetime

from pprint import pprint as pp

timestamp = datetime.datetime.now().strftime('%Y-%m-%d%H:%M:%S')
pub_key = 
priv_key = 


def hash_params():
    """ Marvel API requires server side API calls to include
    md5 hash of timestamp + public key + private key """

    hash_md5 = hashlib.md5()
    hash_md5.update(f'{timestamp}{priv_key}{pub_key}'.encode('utf-8'))
    hashed_params = hash_md5.hexdigest()

    return hashed_params

params = {'ts': timestamp, 'apikey': pub_key, 'hash': hash_params()};
res = requests.get('https://gateway.marvel.com:443/v1/public/characters',
                   params=params)

results = res.json()
result2 = results.get("data").get("results")
print("\n")
print("\n")
#results = len(results.get("data").get("results"))
i = 0
j = 0


for i in range(len(result2)):
    #print(i)
    print(str(i) + ": Character: " + result2[i].get("name"))
    print("\n***Apperences***")
    for j in range(len(result2[i].get("comics").get("items"))):
        print(result2[i].get("comics").get("items")[j].get("name"))
    #print(result2[i].get("comics").get("items"))
    print("\n")

