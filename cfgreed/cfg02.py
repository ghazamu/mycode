#!/usr/bin/env python3

usr_input = input("Enter file name: ")
## create file object in "r"ead mode
configfile = open(usr_input, "r")

## display file to the screen - .read()
configblog = configfile.read()

## break configblog across line boundaries (strips out \n)
configlist = configblog.splitlines()

## display list with no "\n"
print(configlist)

print("Number of lines = " + str(len(configlist)))

## Always close your file
configfile.close()