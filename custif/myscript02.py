#!usr/bin/env python3

def menu():
	print ("Select one of the following commands")
	print ("1. Show interface")
	print ("2. Show log messages")
	print ("3. Show interface diagnostics optics")

def main():
	menu()
	usr_input = input("Select a command: ")
	command = input("Enter the interface (eg: xe-) : ")
		
	if usr_input == "1":
		print ("show interface " + command)
	elif usr_input == "2":
		print ("show log message | match " + command)
	elif usr_input == "3":
		print ("show interface diagnostics optics " + command)

	else:
		print ("Wrong option! Try again.")

main()
	