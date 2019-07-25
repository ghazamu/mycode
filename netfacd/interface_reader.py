#!/usr/bin/env python3
import netifaces

print(netifaces.interfaces())
for i in netifaces.interfaces():
	print('\n****Details of interface - ' + i + '****')
	print('MAC: ', end='')
	print(netifaces.ifaddresses(i)[netifaces.AF_LINK][0]['addr'])
	print('IP: ', end='')
	print(netifaces.ifaddresses(i)[netifaces.AF_INET][0]['addr'])

def find_ip():
	print('\n****FIND IP****')
	adap_name_in = input("Enter Adapter name: ")
	for adap_name in netifaces.interfaces():
		if (adap_name_in == adap_name):
			print('IP: ', end='')
			print(netifaces.ifaddresses(adap_name)[netifaces.AF_INET][0]['addr'])
			break
		else:
			print("Adapter name not found. Try agin.")
			continue

def find_mac(adap_name_in):
	for adap_name in netifaces.interfaces():
		if (adap_name_in == adap_name):
			print('MAC: ', end='')
			print(netifaces.ifaddresses(adap_name)[netifaces.AF_LINK][0]['addr'])
			break

def main():
	find_ip()

	print('\n****FIND MAC****')
	adap_input2 = input("Enter Adapter name: ")
	find_mac(adap_input2)
	
main()	