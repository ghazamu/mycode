#!/usr/bin/env python3



def showInstructions():
	print('''
	RPG game
	========
	Commands:
		go [direction]
		get [item]
		drop [item]
		use [item]
		Enter 'q' to QUIT
	''')

def showStatus(rooms, inventory, currentroom):

	print('---------------------')
	print('You are in the ' + currentroom)
	print('Inventory: ' + str(inventory))
	print(rooms[currentroom]['item'])
	if "item" in rooms[currentroom]:
		for i in rooms[currentroom]['item']:
			print('You see a ' + i)

	print('---------------------')


def play(rooms, inventory, currentroom):
	showInstructions()
	
	while True:
	
		showStatus(rooms,inventory,currentroom)
		move = ''
		while move == '':
			move = input('Whats your move? > ')
	
		move = move.lower().split()
		
		if move[0] == 'go':
			if move[1] in rooms[currentroom]:
				currentroom = rooms[currentroom][move[1]]
			else:
				print("You can't go that way!")
		if move[0] == 'get':
			if "item" in rooms[currentroom]:
				for i in range(len(rooms[currentroom]['item'])):
					if move[1] == rooms[currentroom]['item'][i]:
						inventory += [move[1]]
						print(move[1] + ' got!')
						del rooms[currentroom]['item'][i]
						break
			else:
				print("Can't get " + move[1] + '!')
	
		if move[0] == 'drop':
			if move[1] in inventory:
				print('You droped your item here')
				inventory.remove(move[1])
				rooms[currentroom]['item'].append(move[1])
				
			else:
				print("No such item in inventory!")
	
		if move[0] == 'q':
			break

def main():
	currentroom = 'Hall'
	inventory = []
	rooms = {
		''
		'Hall': {
			'south':'Kitchen',
			'north':'Bathroom', 
			'east':'Dinning Room',
			'item':[]
			},
		
		'Bathroom': {
			'south':'Hall', 
			'item':['plunger']
			}, 
		
		'Kitchen': {
			'north':'Hall', 
			'item':['monster']
			}, 
		
		'Dinning Room':{
			'west':'Hall',
			'south':'Garden',
			'item': ['cookie'] 
			},
	
		'Garden':{
			'north':'Dinning Room',
			'item' :['sword']
			}
		}
	
	play(rooms, inventory, currentroom)

main()
		

 