#!/usr/bin/env python3

configfile = open('clanconfig.cfg')
print(configfile.read())
configfile.close()

configfile = open('clanconfig.cfg', 'r')
configlist = configfile.readlines()
for x in configlist:
	print(x.rstrip().strip())

configfile.close()
