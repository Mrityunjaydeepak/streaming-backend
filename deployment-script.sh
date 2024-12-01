#!/bin/bash

# Define the service name
SERVICE_NAME="streamingbackend.service"

# Check the service status
SERVICE_STATUS=$(systemctl is-active "$SERVICE_NAME")

if [ "$SERVICE_STATUS" = "active" ]; then
    echo "$SERVICE_NAME is running. Restarting the service..."
    systemctl restart "$SERVICE_NAME"
elif [ "$SERVICE_STATUS" = "inactive" ]; then
    echo "$SERVICE_NAME is stopped. Starting the service..."
    systemctl start "$SERVICE_NAME"
else
    echo "$SERVICE_NAME is in an unknown state: $SERVICE_STATUS."
fi