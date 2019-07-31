#!/usr/bin/env python3

import json

def main():
	with open("datacenter.json") as datacenter:
		datacenterstring = datacenter.read()
	print(datacenterstring)
	print(type(datacenterstring))
	
	datacenterdecoded = json.loads(datacenterstring)

	print(type(datacenterdecoded))
	print(datacenterdecoded["row3"])
	print(datacenterdecoded["row2"][0])

main()