#!/usr/bin/python3

import sqlite3

conn = sqlite3.connect('test.db')
cur = conn.cursor()

print("Opened database successfully")

conn.execute('''CREATE TABLE IF NOT EXISTS COMPANY 
	(ID INT Primary KEY NOT NULL,
	NAME TEXT		NOT NULL,
	AGE INT			NOT NULL,
	ADDRESS			CHAR(50),
	SALARY			REAL);''')

print("Table created successfully")

try:
	myop = '''INSERT INTO COMPANY (ID, NAME, AGE, ADDRESS, SALARY) VALUES ('''
	
	cur.execute("INSERT INTO COMPANY (ID, NAME,AGE, ADDRESS, SALARY) VALUES (1, 'Paul', 32, 'California', 20000.00)")
	
	cur.execute(myop + "2, 'Allen', 25, 'Texas', 15000)")
	
	cur.execute(myop + "3, 'Ali', 60, 'Virginia', 22000000)")
	
	cur.execute(myop + "4, 'Mark', 18, 'Texas', 5000)")
	
	conn.commit()

except sqlite3.IntegrityError:
	print("Error updating table")

else: 
	print("Records updates successfully")


cur.execute("SELECT * FROM COMPANY")
for items in cur.fetchall():
	print(f"{items[0]}: {items[1]} | {items[2]} | {items[3]} | {items[4]}")

conn.close()