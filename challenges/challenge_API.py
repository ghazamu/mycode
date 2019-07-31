#!/usr/bin/python3

import requests

URL = "https://www.anapioficeandfire.com/api/books"

def get_json(URL):

	areq = requests.get(URL)
	return areq.json()


def main():
	got_json = get_json(URL)
	usr_input = input("Enter a GOT book name: ")
	for i in range(len(got_json)):
		if "name" in got_json[i]:
			if usr_input == got_json[i].get("name"):
				print("\nBook: " + got_json[i].get("name"))
				got_authors = ",".join(got_json[i].get("authors"))
				print("Authors: " + got_authors)
				print("Publisher: " + got_json[i].get("publisher"))
'''
		if "authors" in got_json[i]:
			got_authors = ",".join(got_json[i].get("authors"))
			print("Authors: " + got_authors)
		if "publisher" in got_json[i]:
			print("Publisher: " + got_json[i].get("publisher"))
'''	
	
	

main()