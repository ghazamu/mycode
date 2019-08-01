#!/usr/bin/env python3
import argparse
import requests
import pprint


STOCKURI = 'https://www.alphavantage.co/query?function='


def stockapicall(key,keyword):
	r = requests.get(STOCKURI+"SYMBOL_SEARCH&keywords=" + keyword + "&apikey="+key)
	return r.json()


def main():
	with open(args.dev) as mykey:
		market = mykey.read().rstrip('\n')
	keyword = input("What stock are you looking for?\n>")

	msstock = stockapicall(market,keyword)

	print("This is what we found...")
	print("\nSymbol: "+msstock['bestMatches'][0].get("1. symbol"))
	print("Name: "+msstock['bestMatches'][0].get("2. name"))



## Define arguments to collect
if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('dev', \
	help='Provide the /path/to/file.priv containing Marvel private developer key')

	args = parser.parse_args()
	main()