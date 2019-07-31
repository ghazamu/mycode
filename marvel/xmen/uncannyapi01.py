#!/usr/bin/python3

import argparse
import time
import hashlib
import requests


XAVIER = "https://gateway.marvel.com:443/v1/public/characters"

def hashbuilder(timestone, beast, storm):
	return hashlib.md5((timestone+beast+storm).encode('utf-8')).hexdigest()

def marvelcharcall(timestone, storm, cerebro, lookmeup):
	deadpool = requests.get(XAVIER + "?name="+lookmeup+"&ts="+timestone+"&apikey="+storm+"&hash=" + cerebro)
	return deadpool.json()


def main():
	with open(args.dev) as mccoy:
		beast = mccoy.read().rstrip('\n')

	with open(args.pub) as munroe:
		storm = munroe.read().rstrip('\n')

	timestone = str(time.time()).rstrip('.')

	cerebro = hashbuilder(timestone, beast, storm)
	uncannyxmen = marvelcharcall(timestone, storm, cerebro, 'Wolverine')

	print('\n\n')
	for i in range(len(uncannyxmen['data']['results'])):
		print("ID:\n" + str(uncannyxmen['data']['results'][i].get('id'))+'\n')
		print("Name:\n" + uncannyxmen['data']['results'][i].get('name')+'\n')
		print("Description:\n" + uncannyxmen['data']['results'][i].get('description')+'\n')
		print("Comics:")
		j = 0
		for i in range(len(uncannyxmen['data']['results'][i].get('comics').get('items'))):
			print(uncannyxmen['data']['results'][i].get('comics').get('items')[j].get('name'))
			j+=1
			
	

if __name__=='__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('--dev', help='Provide the /path/to/file.priv containing Marvel private developer key')
	parser.add_argument('--pub', help='Provide the /path/to/file.pub containing Marvel public developer key')
	args = parser.parse_args()
	main()