#!/usr/bin/env python3

round = 0
while(True):
	round += 1
	print ('Finish the movie title "Monty Python\'s The Life of ______"')
	answer = input()
	correct = 'Brian'
	secret = 'shrubbery'
	if (answer.lower() == correct.lower()):
		print('Correct!')
		break
	
	elif (answer.lower() == secret.lower()):
		print('You have given the super secret answer!')
		break

	elif(round == 3):
		print('The answer was Brian.')
		break
	else:
		print("Sorry! Try again")