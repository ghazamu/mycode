#!/usr/bin/env python3
"""Alta3 Research || Author: RZFeeser@alta3.com"""

# function to push commands
def commandpush(devicecmd): # devicecmd==list 
    for coffeetime in devicecmd.keys():
        print('\nHandshaking. .. ... connecting with ' + coffeetime )
        # we'll learn to write code that connects to devices here
        for mycmds in devicecmd[coffeetime]:
            print('Attempting to sending command --> ' + mycmds )
            # we'll learn to write code that sends cmds to device here

def devicereboot(deviceip):
    for ip in deviceip:
        print("\nConnecting to..." + ip)
        print("REBOOTING NOW!")

def work2do():
	with open("ipcmd.txt") as work:
		w2d = work.readlines()
		new = (','.join(w2d).replace('\n','')).split(',')
		print(new)	
	

# start our main script
def main():
    work2do = {"10.1.0.1":["interface eth1/2", "no shut"], "10.2.0.1":["interface eth1/1", "shutdown"], "10.3.0.1":["interface eth1/5", "no shutdown"]} # data that replaces data stored in file
    ip_list = ["10.1.0.1", "10.2.0.1", "10.3.0.1", "10.4.0.1"]
    print("Welcome to the network device command pusher") # welcome message

    ## get data set
    print("\nData set found\n") # replace with function call that reads in data from file

    ## run 
    commandpush(work2do) # call function to push commands to devices
    devicereboot(ip_list)

# call our main function
#main()
work2do()