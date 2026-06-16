from setuptools import setup, find_packages

with open("requirements.txt", "r", encoding="utf-8") as f:
    install_requires = [line.strip() for line in f if line.strip() and not line.startswith("#")]

setup(
    name="agricultural-price-monitor",
    version="1.0.0",
    description="省级农产品批发市场价格监测预警系统",
    author="农业农村厅信息中心",
    packages=find_packages(exclude=["tests", "tests.*"]),
    include_package_data=True,
    package_data={
        "price_monitor": ["config.yaml"],
    },
    python_requires=">=3.11",
    install_requires=install_requires,
    entry_points={
        "console_scripts": [
            "price_monitor=price_monitor.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
