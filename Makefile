.PHONY: dev api dashboard install

dev:
	make -j2 api dashboard

api:
	uvicorn api.main:app --reload --port 8000

dashboard:
	cd dashboard && npm run dev

install:
	pip install -r requirements.txt
	cd dashboard && npm install
