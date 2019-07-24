#!/usr/bin/env python3

calc1 = 0.0
calc2 = 0.0
operation = ""
while(calc1 != "q"):
	print ("\nWhat is the first operator? Or, enter q to quit: ")
	calc1 = input()
	quit = 'q'
	if calc1.lower() == quit.lower():
		break

	elif calc2 != quit.lower():
		try:	
			calc1 = float(calc1)
		except ValueError:
			print("Not a float! Try again.")
			break
		
	
	print ("What is the second operator? Or, enter q to quit: ")
	calc2 = input()
	
	if calc2.lower() == quit.lower():
		break
	
	elif calc2 != quit.lower():
		try:
			calc2 = float(calc2)
		except ValueError:
			print("Not a float! Try again.")
			break
			

	print("Enter an operation to perform on the two operators (+ or -): ")
	operation = input()
	
	
	print(isinstance(calc1, float))
	print(isinstance(calc2, float))
	
	if operation == "+":
		result_add = calc1 + calc2
		print(str(calc1) + " + " + str(calc2) + " = " + str(result_add))
	
	elif operation == "-":
		result_sub = str(calc1 - calc2)
		print(str(calc1) + " - " + str(calc2) + " = " + str(result_sub))

	else:
		print("Not a valid entry. Restarting...")