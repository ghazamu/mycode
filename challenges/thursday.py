#!/usr/bin/env python3

def sortList(list):
	short = 0
	medium = 0
	long = 0
	for i in list:
		if len(i) < 5:
			short += 1
		elif ((len(i) > 5) and (len(i) < 10)):
			medium += 1
		elif (len(i) >= 10):
			long += 1
	print ("Short: " + str(short))
	print ("Medium: " + str(medium))
	print ("long: " + str(long))

mylist = ['banana','blueberries','nuts','acorns']
sortList(mylist)