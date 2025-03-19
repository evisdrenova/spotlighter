# nested_functions.py

def outer_function(x):
    """
    An outer function that takes an argument and defines an inner function.
    """

    def inner_function(y):
        """
        An inner function that uses the outer function's argument.
        """
        return x + y

    return inner_function

def calculator(operation):
    """
    A function that returns other functions based on the operation.
    """
    def add(a, b):
        return a + b

    def subtract(a, b):
        return a - b

    def multiply(a, b):
        return a * b

    def divide(a, b):
        if b == 0:
            return "Cannot divide by zero"
        return a / b

    if operation == "add":
        return add
    elif operation == "subtract":
        return subtract
    elif operation == "multiply":
        return multiply
    elif operation == "divide":
        return divide
    else:
        return None

def apply_operation(func, *args):
    """
    A function that applies a given function to a variable number of arguments.
    """
    if callable(func):
        return func(*args)
    else:
        return "Invalid function"

def create_multiplier(factor):
    """
    creates a multiplier function
    """
    def multiplier(number):
        return number * factor

    return multiplier

def complex_function(a, b):
    """
    A function with multiple nested functions to perform a complex calculation.
    """
    def square(n):
        return n * n

    def cube(n):
        return n * n * n

    def sum_squares_cubes(x, y):
        return square(x) + cube(y)

    return sum_squares_cubes(a, b)

def recursive_factorial(n):
  """
  A recursive function to calculate factorial.
  """
  if n == 0:
    return 1
  else:
    return n * recursive_factorial(n-1)

def composed_function(f, g):
    """
    Returns a function that is the composition of f and g.
    """
    def composed(x):
        return f(g(x))
    return composed

if __name__ == "__main__":
    # Example usage:
    inner_add = outer_function(10)
    print(inner_add(5))  # Output: 15

    add_func = calculator("add")
    print(add_func(3, 4))  # Output: 7

    multiply_func = calculator("multiply")
    print(apply_operation(multiply_func, 5, 6)) #output 30

    multiply_by_3 = create_multiplier(3)
    print(multiply_by_3(7)) #output 21

    print(complex_function(2, 3)) #output 31

    print(recursive_factorial(5)) #output 120

    def square(x):
        return x * x

    def add_one(x):
        return x + 1

    composed_square_add_one = composed_function(square, add_one)
    print(composed_square_add_one(4)) #output 25